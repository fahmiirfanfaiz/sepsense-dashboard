import { getIO } from "../configs/socket.js";
import { db } from "../prisma/db.ts";

// Cache in-memory untuk konteks device & session agar meminimalisir overhead database
const deviceContextCache = new Map();

// Buffer 18 sampel terakhir per device (18 sampel x 10 detik = 3 menit jendela waktu)
const deviceSampleBuffers = new Map();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

// Jumlah sampel minimum sebelum klasifikasi risiko dapat dilakukan (3 menit = 18 sampel)
const WARMUP_SAMPLE_THRESHOLD = 18;

// Status gerakan valid yang dikirim oleh firmware hardware
const VALID_BPM_STATUSES = new Set([
    "TIDAK_MENEMPEL", "SINYAL_JENUH", "GERAK", "MENUNGGU", "SINYAL_LEMAH", "BAIK",
]);

// Label teks untuk setiap status gerakan (ditampilkan di frontend)
const BPM_STATUS_LABEL = {
    TIDAK_MENEMPEL: "Tidak Menempel",
    SINYAL_JENUH:   "Sinyal Jenuh",
    GERAK:          "Gerak",
    MENUNGGU:       "Menunggu",
    SINYAL_LEMAH:   "Sinyal Lemah",
    BAIK:           "BAIK",
};

// Peta label evaluasi risk score (0–4)
const RISK_LEVEL_MAP = {
    0: "Stabil",
    1: "Perlu Diamati",
    2: "Waspada",
    3: "Perlu Perhatian",
    4: "Mohon Diperiksa",
};

/**
 * Ekstrak dan normalisasi status gerakan BPM dari payload hardware.
 * Firmware bisa mengirim field dengan berbagai nama.
 */
function extractBpmStatus(data) {
    const raw = data.bpmStatus
        || data.motionStatus
        || data.movementStatus
        || data.statusGerakan
        || data.motion
        || data.signal
        || "";
    const upper = String(raw).trim().toUpperCase();

    if (VALID_BPM_STATUSES.has(upper)) return upper;

    // Normalisasi alias firmware lama
    if (["DISCONNECTED", "NO_FINGER", "OFF"].includes(upper)) return "TIDAK_MENEMPEL";
    if (["SATURATED", "OVERLOADED"].includes(upper)) return "SINYAL_JENUH";
    if (["WEAK", "LOW_SIGNAL"].includes(upper)) return "SINYAL_LEMAH";
    if (["MOVING", "MOTION_DETECTED"].includes(upper)) return "GERAK";
    if (["WAITING", "INITIALIZING"].includes(upper)) return "MENUNGGU";

    // Default: sinyal dianggap baik jika ada nilai HR yang valid
    return "BAIK";
}

/**
 * Hitung median dari array angka.
 */
function calcMedian(arr) {
    if (!arr || arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Hitung standar deviasi populasi dari array angka.
 */
function calcStdDev(arr) {
    if (!arr || arr.length <= 1) return 0;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

/**
 * Perbarui buffer sampel device dan hitung statistik jendela 3 menit.
 * Mengimplementasi metode median sebagai representasi nilai utama yang kebal artefak.
 *
 * @param {string|number} deviceId
 * @param {object} reading  - { heartRate, spo2, temperature, respiratoryRate }
 * @returns {object} windowStats
 */
function updateDeviceBuffer(deviceId, reading) {
    const key = String(deviceId);
    let buf = deviceSampleBuffers.get(key);
    if (!buf) {
        buf = [];
        deviceSampleBuffers.set(key, buf);
    }

    // Tambahkan sampel terbaru ke buffer, batasi 18 sampel (3 menit)
    buf.push({ ...reading, _ts: Date.now() });
    if (buf.length > 18) buf.shift();

    // Filter nilai fisiologis yang valid (outlier / artefak dibuang)
    const validHr   = buf.map(r => r.heartRate).filter(v => v != null && v >= 20  && v <= 250);
    const validSpo2 = buf.map(r => r.spo2).filter(v => v != null && v >= 40  && v <= 100);
    const validTemp = buf.map(r => r.temperature).filter(v => v != null && v >= 28 && v <= 44);
    const validResp = buf.map(r => r.respiratoryRate).filter(v => v != null && v >= 4  && v <= 70);

    // 1. Median sebagai representasi nilai utama yang kebal artefak
    const hrMedian   = calcMedian(validHr);
    const spo2Median = calcMedian(validSpo2);
    const tempMedian = calcMedian(validTemp);
    const respMedian = calcMedian(validResp);

    // 2. Standar deviasi sebagai pengukur derajat ketidakstabilan sinyal
    const hrVariability = calcStdDev(validHr);

    // 3. Delta trend pergerakan HR selama jendela
    const hrTrend = validHr.length > 1 ? validHr[validHr.length - 1] - validHr[0] : 0;

    // 4. Signal Stability Score (0–100%)
    const stabilityScore = Math.round((validHr.length / 18) * 100);

    return {
        sampleCount:    buf.length,
        stabilityScore,
        hrMedian:    hrMedian   != null ? Math.round(hrMedian)        : null,
        spo2Median:  spo2Median != null ? Math.round(spo2Median)      : null,
        tempMedian:  tempMedian != null ? +tempMedian.toFixed(1)      : null,
        respMedian:  respMedian != null ? Math.round(respMedian)      : null,
        hrVariability: +hrVariability.toFixed(2),
        hrTrend:       +hrTrend.toFixed(2),
        // Dianggap stabil jika >= 60% sampel valid dan variabilitas HR < 20 bpm
        isStable: stabilityScore >= 60 && hrVariability < 20,
    };
}

/**
 * Reset buffer sampel device. Dipanggil ketika device reconnect setelah
 * jeda panjang (> 5 menit tanpa sampel) agar warm-up dimulai ulang.
 */
function resetDeviceBufferIfStale(deviceId) {
    const key = String(deviceId);
    const buf = deviceSampleBuffers.get(key);
    if (!buf || buf.length === 0) return;

    const lastSampleTs = buf[buf.length - 1]._ts ?? 0;
    const staleThresholdMs = 5 * 60 * 1000; // 5 menit

    if (Date.now() - lastSampleTs > staleThresholdMs) {
        deviceSampleBuffers.set(key, []);
        console.log(`[MQTT] Buffer device ${deviceId} direset karena data sudah kedaluwarsa (> 5 menit).`);
    }
}

/**
 * Panggil AI FastAPI service untuk mengklasifikasi risiko sepsis dari bacaan sensor fisiologis
 */
async function getAiPrediction(data, tempVal) {
    try {
        const body = {
            heart_rate:        data.heartRate       != null ? Number(data.heartRate)       : null,
            spo2:              data.spo2             != null ? Number(data.spo2)             : null,
            temperature:       tempVal              != null ? Number(tempVal)              : null,
            respiratory_rate:  data.respiratoryRate != null ? Number(data.respiratoryRate) : null,
        };

        const res = await fetch(`${AI_SERVICE_URL}/predict/realtime`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(body),
            signal:  AbortSignal.timeout(1500),
        });

        if (res.ok) {
            return await res.json();
        }
    } catch {
        // Fallback gracefully jika AI service offline
    }
    return null;
}

/**
 * Mendapatkan atau membuat Device dan MonitoringSession yang aktif
 */
async function getOrCreateDeviceContext(rawDeviceId, data) {
    const cached = deviceContextCache.get(rawDeviceId);
    const now = Date.now();

    // Cache valid selama 60 detik jika session masih sama
    if (cached && now - cached.cachedAt < 60_000) {
        return cached;
    }

    const deviceIdNum = Number(rawDeviceId);
    const hasNumericId = !isNaN(deviceIdNum);

    // 1. Cari Device di database
    let device = null;
    if (hasNumericId) {
        device = await db.orm.public.Device.where({ id: deviceIdNum }).first();
    }
    if (!device) {
        device = await db.orm.public.Device.where({ deviceCode: `SEPSENSE_0${rawDeviceId}` }).first()
            || await db.orm.public.Device.where({ deviceCode: String(rawDeviceId) }).first();
    }

    // 2. Jika Device belum ada, auto-provision
    const nowIso = new Date().toISOString();
    const statusMax30102 = Boolean(data.heartRate != null || data.spo2 != null || (data.hrConf && data.hrConf > 0));
    const statusMpu6050  = Boolean(data.respiratoryRate != null || (data.rrConf && data.rrConf > 0));
    const statusMlx90614 = Boolean(data.temperature != null || data.objectTemp != null);

    if (!device) {
        try {
            device = await db.orm.public.Device.create({
                id:              hasNumericId ? deviceIdNum : undefined,
                deviceCode:      `SEPSENSE_0${rawDeviceId}`,
                label:           `Bed ${rawDeviceId}`,
                isActive:        true,
                lastHeartbeatAt: nowIso,
                statusMax30102,
                statusMpu6050,
                statusMlx90614,
            });
            console.log(`[MQTT] Berhasil auto-provision device baru: ${device.deviceCode} (ID: ${device.id})`);
        } catch (err) {
            console.warn(`[MQTT] Auto-provision fallback:`, err.message);
            device = await db.orm.public.Device.first();
        }
    }

    if (!device) {
        throw new Error(`Tidak dapat mengidentifikasi atau membuat device untuk ${rawDeviceId}`);
    }

    // 3. Cari atau buat MonitoringSession aktif
    let session = await db.orm.public.MonitoringSession.where({
        deviceId: device.id,
        endedAt:  null,
    }).include("patient").first();

    if (!session) {
        // Buat default patient jika belum ada sesi
        let patient = await db.orm.public.Patient.create({
            medicalRecordNo: `RM-${String(device.id).padStart(3, "0")}`,
            name:            `Pasien Bed ${device.id}`,
            roomBed:         `ICU - ${device.label || `Bed ${device.id}`}`,
        });

        const doctor = await db.orm.public.User.first();
        session = await db.orm.public.MonitoringSession.create({
            deviceId:   device.id,
            patientId:  patient.id,
            startedBy:  doctor ? doctor.id : 1,
            startedAt:  nowIso,
        });
        session = { ...session, patient };
        console.log(`[MQTT] Dibuat sesi monitoring baru (ID: ${session.id}) untuk Bed ${device.id}`);
    }

    const context = {
        device,
        session,
        lastDbUpdate: 0,
        cachedAt:     now,
    };
    deviceContextCache.set(rawDeviceId, context);
    return context;
}

export async function processTelemetry(rawDeviceId, data) {
    try {
        const nowIso = new Date().toISOString();
        const now    = Date.now();

        console.log(`[Telemetry] Data diterima dari device: ${rawDeviceId} | temp: ${data.temperature ?? data.objectTemp} | risk: ${data.riskScore}`);

        // Ambil konteks device dan session
        const context = await getOrCreateDeviceContext(rawDeviceId, data);
        const { device, session } = context;

        // Hitung status sensor berdasarkan data
        const statusMax30102 = Boolean(data.heartRate != null || data.spo2 != null || (data.hrConf && data.hrConf > 0) || (data.signal && data.signal !== "DISCONNECTED"));
        const statusMpu6050  = Boolean(data.respiratoryRate != null || (data.rrConf && data.rrConf > 0));
        const statusMlx90614 = Boolean(data.temperature != null || data.objectTemp != null || data.ambientTemp != null);

        // Update heartbeat di database setiap minimal 3 detik untuk efisiensi
        if (now - context.lastDbUpdate > 3_000) {
            context.lastDbUpdate = now;
            try {
                await db.orm.public.Device.where({ id: device.id }).update({
                    lastHeartbeatAt: nowIso,
                    statusMax30102,
                    statusMpu6050,
                    statusMlx90614,
                });
                device.lastHeartbeatAt = nowIso;
                device.statusMax30102  = statusMax30102;
                device.statusMpu6050   = statusMpu6050;
                device.statusMlx90614  = statusMlx90614;
            } catch (dbErr) {
                console.error("[MQTT] Gagal update heartbeat di DB:", dbErr.message);
            }
        }

        const tempVal    = data.temperature ?? data.objectTemp ?? null;
        const recordedAt = data.tsMs ? new Date(data.tsMs).toISOString() : nowIso;

        // Ekstrak status gerakan BPM dari payload hardware
        const bpmStatus      = extractBpmStatus(data);
        const bpmStatusLabel = BPM_STATUS_LABEL[bpmStatus] || bpmStatus;

        // Reset buffer jika device sempat offline > 5 menit (agar warm-up dimulai ulang)
        resetDeviceBufferIfStale(device.id);

        // Perbarui buffer sampel 3 menit dan hitung statistik median
        const windowStats = updateDeviceBuffer(device.id, {
            heartRate:       data.heartRate,
            spo2:            data.spo2,
            temperature:     tempVal,
            respiratoryRate: data.respiratoryRate,
        });

        // ─────────────────────────────────────────────────────────────────────
        // WARM-UP GATE: Klasifikasi risiko HANYA dilakukan setelah 3 menit
        // (18 sampel x 10 detik) terkumpul sejak device terhubung ke backend.
        // Sebelum itu, kirim payload dengan warmingUp: true tanpa risk score.
        // ─────────────────────────────────────────────────────────────────────
        const isWarmedUp = windowStats.sampleCount >= WARMUP_SAMPLE_THRESHOLD;

        if (!isWarmedUp) {
            console.log(`[MQTT] Warm-up device ${device.id}: ${windowStats.sampleCount}/${WARMUP_SAMPLE_THRESHOLD} sampel terkumpul.`);

            // Konstruksi bedUpdate minimal selama warm-up (tanpa risk assessment)
            const bedUpdateWarmup = {
                deviceId:        device.id,
                deviceCode:      device.deviceCode,
                label:           device.label ?? `Bed ${device.id}`,
                isConnected:     true,
                lastHeartbeatAt: nowIso,
                sensorStatus: {
                    max30102: statusMax30102,
                    mpu6050:  statusMpu6050,
                    mlx90614: statusMlx90614,
                },
                session: { id: session.id, startedAt: session.startedAt },
                patient: session.patient ? {
                    id:              session.patient.id,
                    name:            session.patient.name,
                    medicalRecordNo: session.patient.medicalRecordNo,
                    roomBed:         session.patient.roomBed,
                } : null,
                // Belum ada risk assessment selama warm-up
                latestRiskAssessment: null,
                latestAiPrediction:   null,
                warmingUp:            true,
                sampleCount:          windowStats.sampleCount,
            };

            const warmupPayload = {
                deviceId:        device.id,
                ...data,
                temperature:     tempVal,
                recordedAt,
                isConnected:     true,
                lastHeartbeatAt: nowIso,
                bpmStatus,
                bpmStatusLabel,
                windowStats,
                // Sinyal ke frontend: klasifikasi belum tersedia
                warmingUp:         true,
                sampleCount:       windowStats.sampleCount,
                riskAssessment:    null,
                aiPrediction:      null,
                latestAiPrediction: null,
                bed:               bedUpdateWarmup,
            };

            // Simpan VitalReading ke DB selama warm-up (agar data historis tersedia)
            // tetapi TIDAK menyimpan RiskAssessment dan TIDAK memanggil AI service
            try {
                await db.orm.public.VitalReading.create({
                    sessionId:       session.id,
                    recordedAt,
                    receivedAt:      nowIso,
                    heartRate:       data.heartRate       ?? null,
                    respiratoryRate: data.respiratoryRate ?? null,
                    spo2:            data.spo2            ?? null,
                    temperature:     tempVal,
                });
            } catch (saveErr) {
                console.warn("[MQTT] Gagal menyimpan VitalReading saat warm-up:", saveErr.message);
            }

            // Broadcast ke semua client
            const io = getIO();
            io.emit("device:status", bedUpdateWarmup);
            io.emit("device:telemetry", warmupPayload);
            io.to("overview").emit("overview:bed_update", bedUpdateWarmup);
            io.to(`device:${device.id}`).emit("sensor:data", warmupPayload);
            if (String(rawDeviceId) !== String(device.id)) {
                io.to(`device:${rawDeviceId}`).emit("sensor:data", warmupPayload);
            }

            return { bed: bedUpdateWarmup, telemetry: warmupPayload };
        }

        // ─────────────────────────────────────────────────────────────────────
        // SETELAH 3 MENIT: Jalankan klasifikasi AI dan SIRS rule-based seperti biasa
        // ─────────────────────────────────────────────────────────────────────

        // Klasifikasi Risiko Sepsis berbasis Model AI (XGBoost)
        const aiResult = await getAiPrediction(data, tempVal);

        // Evaluasi kriteria individual fisiologis
        const c1Val = data.c1_hr != null ? Boolean(data.c1_hr) : (data.heartRate != null && data.heartRate > 90);
        const c2Val = data.c2_rr != null ? Boolean(data.c2_rr) : (data.respiratoryRate != null && data.respiratoryRate > 20);
        const c3Val = data.c3_temp != null ? Boolean(data.c3_temp) : (tempVal != null && (tempVal > 38.0 || tempVal < 36.0));
        const c4Val = data.c4_spo2 != null ? Boolean(data.c4_spo2) : (data.spo2 != null && data.spo2 <= 95);

        // Fallback SIRS rule jika AI service tidak dapat dijangkau
        const fallbackScore = (c1Val ? 1 : 0) + (c2Val ? 1 : 0) + (c3Val ? 1 : 0) + (c4Val ? 1 : 0);
        const score         = aiResult
            ? aiResult.risk_score
            : (typeof data.riskScore === "number" ? data.riskScore : fallbackScore);

        // Gunakan peta label evaluasi risk score yang konsisten (0–4)
        const riskLevel = aiResult
            ? (RISK_LEVEL_MAP[aiResult.risk_score] ?? aiResult.risk_level ?? RISK_LEVEL_MAP[0])
            : (RISK_LEVEL_MAP[score] ?? RISK_LEVEL_MAP[0]);

        let assessment = {
            riskScore: score,
            riskLevel,
            c1Hr:       aiResult?.criteria ? aiResult.criteria.c1_hr   : c1Val,
            c2Rr:       aiResult?.criteria ? aiResult.criteria.c2_rr   : c2Val,
            c3Temp:     aiResult?.criteria ? aiResult.criteria.c3_temp : c3Val,
            c4Spo2:     aiResult?.criteria ? aiResult.criteria.c4_spo2 : c4Val,
            evaluatedAt: nowIso,
        };

        let aiPredictionRecord = null;

        try {
            const reading = await db.orm.public.VitalReading.create({
                sessionId:       session.id,
                recordedAt,
                receivedAt:      nowIso,
                heartRate:       data.heartRate       ?? null,
                respiratoryRate: data.respiratoryRate ?? null,
                spo2:            data.spo2            ?? null,
                temperature:     tempVal,
            });

            const dbAssessment = await db.orm.public.RiskAssessment.create({
                vitalReadingId: reading.id,
                c1Hr:           assessment.c1Hr,
                c2Rr:           assessment.c2Rr,
                c3Temp:         assessment.c3Temp,
                c4Spo2:         assessment.c4Spo2,
                riskScore:      score,
                riskLevel,
                evaluatedAt:    nowIso,
            });
            assessment = { ...assessment, id: dbAssessment.id };

            // Simpan AiPrediction ke database jika hasil evaluasi AI tersedia
            if (aiResult) {
                try {
                    aiPredictionRecord = await db.orm.public.AiPrediction.create({
                        sessionId:      session.id,
                        windowStart:    nowIso,
                        windowEnd:      nowIso,
                        modelVersion:   aiResult.model_version || "xgb-v2",
                        probability:    aiResult.probability,
                        predictedLabel: Boolean(aiResult.predicted_label),
                        createdAt:      nowIso,
                    });
                } catch (aiDbErr) {
                    console.warn("[MQTT] Gagal menyimpan AiPrediction ke DB:", aiDbErr.message);
                }
            }

            // Handle alert jika berisiko sepsis
            if (score >= 2 || (aiResult && aiResult.predicted_label)) {
                const existingAlert = await db.orm.public.Alert.where({
                    sessionId: session.id,
                    status:    "ACTIVE",
                }).first();

                if (!existingAlert) {
                    await db.orm.public.Alert.create({
                        sessionId:        session.id,
                        riskAssessmentId: dbAssessment.id,
                        status:           "ACTIVE",
                        triggeredAt:      nowIso,
                    });
                    console.log(`[MQTT] ⚠️ Alert Sepsis aktif untuk Bed ${device.id}`);
                }
            }
        } catch (saveErr) {
            console.error("[MQTT] Gagal menyimpan reading:", saveErr.message);
        }

        const latestAiPrediction = aiPredictionRecord || (aiResult ? {
            probability:    aiResult.probability,
            predictedLabel: aiResult.predicted_label,
            modelVersion:   aiResult.model_version,
            riskLevel:      aiResult.risk_level,
            createdAt:      nowIso,
        } : null);

        // Konstruksi objek bed terkini untuk overview
        const bedUpdate = {
            deviceId:        device.id,
            deviceCode:      device.deviceCode,
            label:           device.label ?? `Bed ${device.id}`,
            isConnected:     true,
            lastHeartbeatAt: nowIso,
            sensorStatus: {
                max30102: statusMax30102,
                mpu6050:  statusMpu6050,
                mlx90614: statusMlx90614,
            },
            session: { id: session.id, startedAt: session.startedAt },
            patient: session.patient ? {
                id:              session.patient.id,
                name:            session.patient.name,
                medicalRecordNo: session.patient.medicalRecordNo,
                roomBed:         session.patient.roomBed,
            } : null,
            latestRiskAssessment: assessment,
            latestAiPrediction,
            warmingUp:   false,
            sampleCount: windowStats.sampleCount,
        };

        const telemetryPayload = {
            deviceId:        device.id,
            ...data,
            temperature:     tempVal,
            recordedAt,
            isConnected:     true,
            lastHeartbeatAt: nowIso,
            // Status gerakan BPM dari hardware
            bpmStatus,
            bpmStatusLabel,
            // Statistik jendela 3 menit (median-based)
            windowStats,
            // Sinyal ke frontend: data sudah siap
            warmingUp:         false,
            sampleCount:       windowStats.sampleCount,
            riskAssessment:    assessment,
            aiPrediction:      latestAiPrediction,
            latestAiPrediction,
            bed:               bedUpdate,
        };

        // Broadcast melalui WebSocket
        const io = getIO();

        // 1. Kirim update status & telemetri ke semua client (overview / main dashboard)
        io.emit("device:status", bedUpdate);
        io.emit("device:telemetry", telemetryPayload);
        io.to("overview").emit("overview:bed_update", bedUpdate);

        // 2. Kirim update ke room spesifik device (detail page)
        io.to(`device:${device.id}`).emit("sensor:data", telemetryPayload);
        if (String(rawDeviceId) !== String(device.id)) {
            io.to(`device:${rawDeviceId}`).emit("sensor:data", telemetryPayload);
        }

        return { bed: bedUpdate, telemetry: telemetryPayload };
    } catch (err) {
        console.error(`[Telemetry] Gagal memproses telemetri device ${rawDeviceId}:`, err.message);
        throw err;
    }
}

export function registerMqttHandler(client) {
    client.on("message", async (topic, payload) => {
        try {
            const parts = topic.split("/");
            // Topik format: sepsense/{deviceId}/telemetry
            const rawDeviceId = parts[1];
            if (!rawDeviceId) return;

            const data = JSON.parse(payload.toString());
            await processTelemetry(rawDeviceId, data);
        } catch (err) {
            console.error("[MQTT] Gagal memproses pesan:", err.message);
        }
    });
}
