/**
 * Script Simulator Telemetri Sensor untuk Memicu Alert Notification, Prediksi AI, & Status Gerakan BPM
 * 
 * Penggunaan:
 *   node scripts/simulate.js --mode sepsis     (Skor 4: Mohon Diperiksa - 4 kriteria abnormal)
 *   node scripts/simulate.js --mode attention  (Skor 3: Perlu Perhatian - 3 kriteria abnormal)
 *   node scripts/simulate.js --mode warning    (Skor 2: Waspada - 2 kriteria abnormal)
 *   node scripts/simulate.js --mode watch      (Skor 1: Perlu Diamati - 1 kriteria abnormal)
 *   node scripts/simulate.js --mode normal     (Skor 0: Stabil - semua parameter normal)
 *   node scripts/simulate.js --motion GERAK    (Menguji status gerakan BPM sensor)
 *   node scripts/simulate.js --mode sepsis --stream --interval 3  (Streaming berkala)
 */
import "dotenv/config";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";

// Parsing argumen CLI
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

const mode = getArg("--mode", "normal").toLowerCase();
const deviceId = getArg("--device", "1");
const motionStatus = getArg("--motion", getArg("--bpm-status", "BAIK")).toUpperCase();
const isStream = args.includes("--stream");
const intervalSec = Number(getArg("--interval", "3"));

function generatePayload(modeType) {
    const now = Date.now();
    let base = {};

    if (modeType === "sepsis") {
        // Kondisi sepsis akut: SEMUA 4 parameter fisiologis di luar batas normal
        // Skor 4: Mohon Diperiksa
        base = {
            deviceId: Number(deviceId),
            heartRate: Math.round(118 + Math.random() * 10),     // Takikardia > 90 (118-128 bpm)
            spo2: Math.round(90 + Math.random() * 3),            // Hipoksia <= 95 (90-93%)
            temperature: +(39.1 + Math.random() * 0.6).toFixed(1), // Demam tinggi > 38.0°C (39.1-39.7°C)
            respiratoryRate: Math.round(26 + Math.random() * 6), // Takipnea > 20 (26-32 rpm)
            c1_hr: true,
            c2_rr: true,
            c3_temp: true,
            c4_spo2: true,
            riskScore: 4,
            signal: "CONNECTED",
            bpmStatus: motionStatus,
            tsMs: now,
        };
    } else if (modeType === "attention") {
        // 3 parameter abnormal -> Skor 3: Perlu Perhatian
        base = {
            deviceId: Number(deviceId),
            heartRate: Math.round(108 + Math.random() * 8),      // Takikardia > 90 bpm
            spo2: Math.round(97 + Math.random() * 2),            // SpO2 normal
            temperature: +(38.5 + Math.random() * 0.4).toFixed(1), // Demam > 38.0°C
            respiratoryRate: Math.round(24 + Math.random() * 3), // Takipnea > 20 rpm
            c1_hr: true,
            c2_rr: true,
            c3_temp: true,
            c4_spo2: false,
            riskScore: 3,
            signal: "CONNECTED",
            bpmStatus: motionStatus,
            tsMs: now,
        };
    } else if (modeType === "warning") {
        // 2 parameter abnormal -> Skor 2: Waspada (ambang batas SIRS)
        base = {
            deviceId: Number(deviceId),
            heartRate: Math.round(98 + Math.random() * 6),       // HR takikardia > 90
            spo2: Math.round(97 + Math.random() * 2),            // SpO2 normal
            temperature: +(36.8 + Math.random() * 0.4).toFixed(1), // Suhu normal
            respiratoryRate: Math.round(22 + Math.random() * 3), // Takipnea > 20
            c1_hr: true,
            c2_rr: true,
            c3_temp: false,
            c4_spo2: false,
            riskScore: 2,
            signal: "CONNECTED",
            bpmStatus: motionStatus,
            tsMs: now,
        };
    } else if (modeType === "watch") {
        // 1 parameter abnormal -> Skor 1: Perlu Diamati
        base = {
            deviceId: Number(deviceId),
            heartRate: Math.round(94 + Math.random() * 4),       // HR sedikit tinggi (>90)
            spo2: Math.round(97 + Math.random() * 2),            // SpO2 normal
            temperature: +(36.8 + Math.random() * 0.4).toFixed(1), // Suhu normal
            respiratoryRate: Math.round(16 + Math.random() * 2), // RR normal
            c1_hr: true,
            c2_rr: false,
            c3_temp: false,
            c4_spo2: false,
            riskScore: 1,
            signal: "CONNECTED",
            bpmStatus: motionStatus,
            tsMs: now,
        };
    } else {
        // normal: SEMUA parameter fisiologis dalam batas normal
        // Skor 0: Stabil
        base = {
            deviceId: Number(deviceId),
            heartRate: Math.round(72 + Math.random() * 8),       // 72-80 bpm (normal)
            spo2: Math.round(98 + Math.random() * 2),            // 98-100% (normal)
            temperature: +(36.5 + Math.random() * 0.4).toFixed(1), // 36.5-36.9°C (normal)
            respiratoryRate: Math.round(15 + Math.random() * 3), // 15-18 rpm (normal)
            c1_hr: false,
            c2_rr: false,
            c3_temp: false,
            c4_spo2: false,
            riskScore: 0,
            signal: "CONNECTED",
            bpmStatus: motionStatus,
            tsMs: now,
        };
    }

    return base;
}

async function sendTelemetry() {
    const payload = generatePayload(mode);
    try {
        const res = await fetch(`${SERVER_URL}/api/simulate-telemetry`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`HTTP ${res.status}: ${errBody}`);
        }

        const data = await res.json();
        const tel = data.result?.telemetry;
        const ai = tel?.aiPrediction || tel?.latestAiPrediction;
        const riskAss = tel?.riskAssessment;

        const evaluatedScore = riskAss?.riskScore ?? payload.riskScore;
        const evaluatedLevel = riskAss?.riskLevel ?? (evaluatedScore === 0 ? "Stabil" : evaluatedScore === 4 ? "Mohon Diperiksa" : "");

        console.log(`\n[Simulator] 📡 Telemetri terkirim untuk Device ${payload.deviceId} [Mode: ${mode.toUpperCase()}]:`);
        console.log(`   - Heart Rate        : ${payload.heartRate} bpm (Status Sensor: ${tel?.bpmStatusLabel || payload.bpmStatus})`);
        console.log(`   - Respiratory Rate  : ${payload.respiratoryRate} rpm (C2: ${payload.c2_rr})`);
        console.log(`   - Temperature       : ${payload.temperature} °C (C3: ${payload.c3_temp})`);
        console.log(`   - SpO2              : ${payload.spo2} % (C4: ${payload.c4_spo2})`);
        console.log(`   - Risk Assessment   : Skor ${evaluatedScore} - "${evaluatedLevel}"`);
        if (tel?.windowStats) {
            console.log(`   - Window Stats 3m   : HR Median=${tel.windowStats.hrMedian} | Stabilitas=${tel.windowStats.stabilityScore}% | Variabilitas=±${tel.windowStats.hrVariability}`);
        }
        if (ai) {
            console.log(`   - AI Prediction     : Probabilitas ${Math.round((ai.probability || 0) * 100)}% | Label: ${ai.predictedLabel ? "🔴 SEPSIS" : "🟢 AMAN"} | v${ai.modelVersion || "xgb-v2"}`);
        }
        const alertStatus = evaluatedScore >= 2 ? "🚨 ALERT TRIGGERED (Popup & Sound aktif di web)" : "✅ Normal/Terpantau (Tanpa alarm panik)";
        console.log(`   - Status Alert      : ${alertStatus}`);
    } catch (err) {
        console.error(`[Simulator] ❌ Gagal mengirim telemetri:`, err.message);
        console.error(`   Pastikan server backend (npm run dev di server) sedang berjalan.`);
    }
}

async function main() {
    console.log(`[Simulator] Memulai simulasi telemetri ke ${SERVER_URL}...`);
    await sendTelemetry();

    if (isStream) {
        console.log(`\n[Simulator] 🔄 Streaming telemetri setiap ${intervalSec} detik. Tekan Ctrl+C untuk berhenti.`);
        setInterval(sendTelemetry, intervalSec * 1000);
    } else {
        console.log(`\n[Simulator] Selesai. Buka browser di http://localhost:3000 untuk melihat perubahan real-time.`);
    }
}

main();
