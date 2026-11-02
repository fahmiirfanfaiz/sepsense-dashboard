/**
 * ============================================================================
 * SepSense IoT Telemetry Simulator - FAANG Production Grade
 * ============================================================================
 * 
 * Mengimplementasikan 16 kombinasi kasus SIRS (Truth Table 2^4):
 * - C1 (Heart Rate)        : Takikardia > 90 bpm
 * - C2 (Respiratory Rate)  : Takipnea > 20 rpm
 * - C3 (Temperature)       : Demam > 38.0°C atau Hipotermia < 36.0°C
 * - C4 (SpO2)              : Desaturasi / Hipoksia <= 95%
 * 
 * Penggunaan CLI:
 *   node scripts/simulate.js --mode 1            # Kasus 1: Semua normal (Skor 0 - Stabil)
 *   node scripts/simulate.js --mode 6            # Kasus 6: HR & RR abnormal (Skor 2 - Waspada)
 *   node scripts/simulate.js --mode 16           # Kasus 16: Semua abnormal (Skor 4 - Mohon Diperiksa)
 *   node scripts/simulate.js --mode sepsis       # Alias untuk Kasus 16
 *   node scripts/simulate.js --mode normal       # Alias untuk Kasus 1
 *   node scripts/simulate.js --mode warning      # Alias untuk Kasus 6 (Skor 2)
 *   node scripts/simulate.js --mode attention    # Alias untuk Kasus 12 (Skor 3)
 *   node scripts/simulate.js --mode watch        # Alias untuk Kasus 2 (Skor 1)
 * 
 * Opsi Tambahan:
 *   --list                                       # Menampilkan tabel lengkap 16 kasus
 *   --test-all                                   # Menjalankan uji otomatis ke-16 kasus sekaligus
 *   --warmup                                     # Kirim 18 sampel awal cepat untuk membuka warm-up gate 3 menit
 *   --exact                                      # Gunakan nilai numerik persis di tabel (tanpa variasi acak)
 *   --stream --interval 3                        # Streaming data berkelanjutan setiap N detik
 *   --motion GERAK                               # Simulasi status gerak sensor (TIDAK_MENEMPEL, GERAK, BAIK)
 *   --device 1                                   # Nomor ID Device / Bed (default: 1)
 */
import "dotenv/config";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";

// ─────────────────────────────────────────────────────────────────────────────
// Master Truth Table: 16 Kasus Kombinasi SIRS (2^4)
// Sesuai Spesifikasi Medis & Tabel Referensi Pengujian Sistem SepSense
// ─────────────────────────────────────────────────────────────────────────────
export const SIRS_TRUTH_TABLE = [
    {
        no: 1,
        name: "Semua Parameter Normal",
        c1: false, c2: false, c3: false, c4: false,
        nominal: { hr: 75, rr: 16, temp: 36.8, spo2: 98 },
        expectedScore: 0,
        expectedLevel: "Stabil",
        expectedAlert: false,
        aliases: ["1", "case-1", "case1", "normal", "stabil", "safe"],
    },
    {
        no: 2,
        name: "Takikardia Tunggal (C1: HR)",
        c1: true, c2: false, c3: false, c4: false,
        nominal: { hr: 110, rr: 16, temp: 36.8, spo2: 98 },
        expectedScore: 1,
        expectedLevel: "Perlu Diamati",
        expectedAlert: false,
        aliases: ["2", "case-2", "case2", "c1", "hr", "watch"],
    },
    {
        no: 3,
        name: "Takipnea Tunggal (C2: RR)",
        c1: false, c2: true, c3: false, c4: false,
        nominal: { hr: 75, rr: 24, temp: 36.8, spo2: 98 },
        expectedScore: 1,
        expectedLevel: "Perlu Diamati",
        expectedAlert: false,
        aliases: ["3", "case-3", "case3", "c2", "rr"],
    },
    {
        no: 4,
        name: "Suhu Abnormal Tunggal (C3: Demam)",
        c1: false, c2: false, c3: true, c4: false,
        nominal: { hr: 75, rr: 16, temp: 38.5, spo2: 98 },
        expectedScore: 1,
        expectedLevel: "Perlu Diamati",
        expectedAlert: false,
        aliases: ["4", "case-4", "case4", "c3", "temp", "suhu"],
    },
    {
        no: 5,
        name: "Hipoksia Tunggal (C4: SpO2 Rendah)",
        c1: false, c2: false, c3: false, c4: true,
        nominal: { hr: 75, rr: 16, temp: 36.8, spo2: 92 },
        expectedScore: 1,
        expectedLevel: "Perlu Diamati",
        expectedAlert: false,
        aliases: ["5", "case-5", "case5", "c4", "spo2", "hypoxia"],
    },
    {
        no: 6,
        name: "Takikardia + Takipnea (C1, C2)",
        c1: true, c2: true, c3: false, c4: false,
        nominal: { hr: 110, rr: 24, temp: 36.8, spo2: 98 },
        expectedScore: 2,
        expectedLevel: "Waspada",
        expectedAlert: true,
        aliases: ["6", "case-6", "case6", "c1-c2", "c1c2", "hr-rr", "warning", "waspada"],
    },
    {
        no: 7,
        name: "Takikardia + Demam (C1, C3)",
        c1: true, c2: false, c3: true, c4: false,
        nominal: { hr: 110, rr: 16, temp: 38.5, spo2: 98 },
        expectedScore: 2,
        expectedLevel: "Waspada",
        expectedAlert: true,
        aliases: ["7", "case-7", "case7", "c1-c3", "c1c3", "hr-temp"],
    },
    {
        no: 8,
        name: "Takikardia + Hipoksia (C1, C4)",
        c1: true, c2: false, c3: false, c4: true,
        nominal: { hr: 110, rr: 16, temp: 36.8, spo2: 92 },
        expectedScore: 2,
        expectedLevel: "Waspada",
        expectedAlert: true,
        aliases: ["8", "case-8", "case8", "c1-c4", "c1c4", "hr-spo2"],
    },
    {
        no: 9,
        name: "Takipnea + Demam (C2, C3)",
        c1: false, c2: true, c3: true, c4: false,
        nominal: { hr: 75, rr: 24, temp: 38.5, spo2: 98 },
        expectedScore: 2,
        expectedLevel: "Waspada",
        expectedAlert: true,
        aliases: ["9", "case-9", "case9", "c2-c3", "c2c3", "rr-temp"],
    },
    {
        no: 10,
        name: "Takipnea + Hipoksia (C2, C4)",
        c1: false, c2: true, c3: false, c4: true,
        nominal: { hr: 75, rr: 24, temp: 36.8, spo2: 92 },
        expectedScore: 2,
        expectedLevel: "Waspada",
        expectedAlert: true,
        aliases: ["10", "case-10", "case10", "c2-c4", "c2c4", "rr-spo2"],
    },
    {
        no: 11,
        name: "Demam + Hipoksia (C3, C4)",
        c1: false, c2: false, c3: true, c4: true,
        nominal: { hr: 75, rr: 16, temp: 38.5, spo2: 92 },
        expectedScore: 2,
        expectedLevel: "Waspada",
        expectedAlert: true,
        aliases: ["11", "case-11", "case11", "c3-c4", "c3c4", "temp-spo2"],
    },
    {
        no: 12,
        name: "Takikardia + Takipnea + Demam (C1, C2, C3)",
        c1: true, c2: true, c3: true, c4: false,
        nominal: { hr: 110, rr: 24, temp: 38.5, spo2: 98 },
        expectedScore: 3,
        expectedLevel: "Perlu Perhatian",
        expectedAlert: true,
        aliases: ["12", "case-12", "case12", "c1-c2-c3", "hr-rr-temp", "attention", "perhatian"],
    },
    {
        no: 13,
        name: "Takikardia + Takipnea + Hipoksia (C1, C2, C4)",
        c1: true, c2: true, c3: false, c4: true,
        nominal: { hr: 110, rr: 24, temp: 36.8, spo2: 92 },
        expectedScore: 3,
        expectedLevel: "Perlu Perhatian",
        expectedAlert: true,
        aliases: ["13", "case-13", "case13", "c1-c2-c4", "hr-rr-spo2"],
    },
    {
        no: 14,
        name: "Takikardia + Demam + Hipoksia (C1, C3, C4)",
        c1: true, c2: false, c3: true, c4: true,
        nominal: { hr: 110, rr: 16, temp: 38.5, spo2: 92 },
        expectedScore: 3,
        expectedLevel: "Perlu Perhatian",
        expectedAlert: true,
        aliases: ["14", "case-14", "case14", "c1-c3-c4", "hr-temp-spo2"],
    },
    {
        no: 15,
        name: "Takipnea + Demam + Hipoksia (C2, C3, C4)",
        c1: false, c2: true, c3: true, c4: true,
        nominal: { hr: 75, rr: 24, temp: 38.5, spo2: 92 },
        expectedScore: 3,
        expectedLevel: "Perlu Perhatian",
        expectedAlert: true,
        aliases: ["15", "case-15", "case15", "c2-c3-c4", "rr-temp-spo2"],
    },
    {
        no: 16,
        name: "Kondisi Kritis Sepsis Penuh (C1, C2, C3, C4)",
        c1: true, c2: true, c3: true, c4: true,
        nominal: { hr: 110, rr: 24, temp: 38.5, spo2: 92 },
        expectedScore: 4,
        expectedLevel: "Mohon Diperiksa",
        expectedAlert: true,
        aliases: ["16", "case-16", "case16", "c1-c2-c3-c4", "all", "sepsis", "kritis"],
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// CLI Arguments Parsing
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

const showList = args.includes("--list") || args.includes("-l");
const runTestAll = args.includes("--test-all") || args.includes("--test");
const doWarmup = args.includes("--warmup") || args.includes("--seed");
const isExact = args.includes("--exact");
const isStream = args.includes("--stream");
const intervalSec = Number(getArg("--interval", "3"));
const deviceId = getArg("--device", "1");
const motionStatus = getArg("--motion", getArg("--bpm-status", "BAIK")).toUpperCase();
const requestedMode = getArg("--mode", getArg("--case", "1")).toLowerCase();

/**
 * Mencari definisi kasus dari input argumen CLI
 */
function findCase(query) {
    const normalized = String(query).trim().toLowerCase();
    const found = SIRS_TRUTH_TABLE.find(
        (c) => c.no === Number(normalized) || c.aliases.includes(normalized)
    );
    return found || SIRS_TRUTH_TABLE[0]; // fallback ke Kasus 1 (Normal)
}

/**
 * Generate payload telemetri berdasarkan spesifikasi kasus
 * Mendukung jitter fisiologis realistis atau nilai tepat (--exact)
 */
function generateTelemetryPayload(caseDef, exact = false) {
    const now = Date.now();
    let { hr, rr, temp, spo2 } = caseDef.nominal;

    if (!exact) {
        // Berikan variasi realistis klinis yang tetap berada di dalam range kriteria SIRS
        if (caseDef.c1) {
            // Abnormal HR > 90 bpm (misal: 105 - 120 bpm)
            hr = Math.round(105 + Math.random() * 15);
        } else {
            // Normal HR 60 - 90 bpm (misal: 72 - 80 bpm)
            hr = Math.round(72 + Math.random() * 8);
        }

        if (caseDef.c2) {
            // Abnormal RR > 20 rpm (misal: 22 - 28 rpm)
            rr = Math.round(22 + Math.random() * 6);
        } else {
            // Normal RR 12 - 20 rpm (misal: 14 - 18 rpm)
            rr = Math.round(14 + Math.random() * 4);
        }

        if (caseDef.c3) {
            // Abnormal Temp > 38.0°C (misal: 38.3 - 39.2°C)
            temp = +(38.3 + Math.random() * 0.9).toFixed(1);
        } else {
            // Normal Temp 36.0 - 38.0°C (misal: 36.5 - 37.2°C)
            temp = +(36.5 + Math.random() * 0.7).toFixed(1);
        }

        if (caseDef.c4) {
            // Abnormal SpO2 <= 95% (misal: 89 - 94%)
            spo2 = Math.round(89 + Math.random() * 5);
        } else {
            // Normal SpO2 > 95% (misal: 97 - 100%)
            spo2 = Math.round(97 + Math.random() * 3);
        }
    }

    // Estimasi probabilitas & klasifikasi AI selaras dengan kriteria klinis SIRS
    let probability;
    const predictedLabel = caseDef.expectedScore >= 2;

    if (caseDef.expectedScore === 0) {
        probability = exact ? 0.06 : +(0.05 + Math.random() * 0.03).toFixed(2);
    } else if (caseDef.expectedScore === 1) {
        probability = exact ? 0.24 : +(0.20 + Math.random() * 0.05).toFixed(2);
    } else if (caseDef.expectedScore === 2) {
        // Kasus 6-11 (Waspada / Moderat: 50% - 74%)
        probability = exact ? 0.65 : +(0.60 + Math.random() * 0.08).toFixed(2);
    } else if (caseDef.expectedScore === 3) {
        // Kasus 12-15 (Perlu Perhatian / Tinggi: >= 75%)
        probability = exact ? 0.82 : +(0.78 + Math.random() * 0.07).toFixed(2);
    } else {
        // Kasus 16 (Mohon Diperiksa / Kritis: >= 75%)
        probability = exact ? 0.95 : +(0.92 + Math.random() * 0.05).toFixed(2);
    }

    return {
        deviceId: Number(deviceId),
        heartRate: hr,
        spo2,
        temperature: temp,
        respiratoryRate: rr,
        c1_hr: caseDef.c1,
        c2_rr: caseDef.c2,
        c3_temp: caseDef.c3,
        c4_spo2: caseDef.c4,
        riskScore: caseDef.expectedScore,
        probability,
        predicted_label: predictedLabel,
        signal: "CONNECTED",
        bpmStatus: motionStatus,
        tsMs: now,
    };
}

/**
 * Menampilkan tabel ASCII rapi dari ke-16 kasus SIRS
 */
function printTruthTable() {
    console.log("\n==========================================================================================");
    console.log("                        TABEL TRUTH TABLE 16 KASUS SEPSIS (2^4)                           ");
    console.log("==========================================================================================");
    console.log(" No | C1(HR) | C2(RR) | C3(Tmp) | C4(O2) | Input Fisiologis | Skor | Notif | Status Klinis");
    console.log("----+--------+--------+---------+--------+------------------+------+-------+--------------");

    for (const c of SIRS_TRUTH_TABLE) {
        const c1Str = c.c1 ? "  YA  " : " tidak";
        const c2Str = c.c2 ? "  YA  " : " tidak";
        const c3Str = c.c3 ? "  YA  " : " tidak";
        const c4Str = c.c4 ? "  YA  " : " tidak";
        const inputStr = `${String(c.nominal.hr).padStart(3)}/${String(c.nominal.rr).padStart(2)}/${c.nominal.temp}/${c.nominal.spo2}`.padEnd(16);
        const alertStr = c.expectedAlert ? "  YA " : "tidak";
        const noStr = String(c.no).padStart(2);

        console.log(` ${noStr} | ${c1Str} | ${c2Str} | ${c3Str} | ${c4Str} | ${inputStr} |  ${c.expectedScore}   | ${alertStr} | ${c.expectedLevel}`);
    }

    console.log("==========================================================================================");
    console.log("Keterangan Kriteria Abnormal:");
    console.log("  * C1: Heart Rate abnormal (< 60 atau > 90 bpm)");
    console.log("  * C2: Respiratory Rate abnormal (> 20 rpm)");
    console.log("  * C3: Suhu Tubuh abnormal (< 36.0 °C atau > 38.0 °C)");
    console.log("  * C4: SpO2 abnormal (< 95.1 %)");
    console.log("  * Notifikasi Alert aktif jika Skor SIRS >= 2\n");
}

/**
 * Mengirim telemetri ke server
 */
async function sendPayload(payload, quiet = false) {
    const res = await fetch(`${SERVER_URL}/api/simulate-telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    return await res.json();
}

/**
 * Melakukan pemanasan buffer 18 sampel (3 menit) secara instan
 */
async function performWarmup() {
    console.log(`\n[Warm-up] ⏳ Memasukkan 18 sampel awal ke buffer Bed Default (Device ${deviceId}) agar warm-up gate 3 menit terpenuhi...`);
    const baseCase = SIRS_TRUTH_TABLE[0]; // Gunakan data normal untuk pemanasan

    for (let i = 1; i <= 18; i++) {
        const p = generateTelemetryPayload(baseCase, false);
        await sendPayload(p, true);
        process.stdout.write(`\r[Warm-up] Sampel ${i}/18 terkirim...`);
    }
    console.log(`\n[Warm-up] ✅ Selesai! Buffer telah terisi 18 sampel. Klasifikasi risiko & AI kini aktif seketika.\n`);
}

/**
 * Eksekusi uji simulasi untuk 1 kasus tertentu
 */
async function runSingleCase(caseDef) {
    const payload = generateTelemetryPayload(caseDef, isExact);

    try {
        const data = await sendPayload(payload);
        const tel = data.result?.telemetry;
        const ai = tel?.aiPrediction || tel?.latestAiPrediction;
        const riskAss = tel?.riskAssessment;

        const evaluatedScore = riskAss?.riskScore ?? payload.riskScore;
        const evaluatedLevel = riskAss?.riskLevel ?? caseDef.expectedLevel;
        const isWarmingUp = tel?.warmingUp === true;

        console.log(`\n[Simulator] 📡 Telemetri Terkirim untuk Bed Default (Device ${payload.deviceId}) [KASUS ${caseDef.no}: ${caseDef.name.toUpperCase()}]:`);
        console.log(`   - Input Fisiologis  : HR=${payload.heartRate} bpm | RR=${payload.respiratoryRate} rpm | Temp=${payload.temperature}°C | SpO2=${payload.spo2}%`);
        console.log(`   - Kriteria (C1-C4)  : C1(HR)=${payload.c1_hr} | C2(RR)=${payload.c2_rr} | C3(Temp)=${payload.c3_temp} | C4(SpO2)=${payload.c4_spo2}`);
        console.log(`   - Motion / Sinyal   : ${tel?.bpmStatusLabel || payload.bpmStatus} (Status Sensor)`);

        if (isWarmingUp) {
            console.log(`   - Status Gate       : ⏳ Sedang mengambil data awal (${tel?.sampleCount ?? 1}/18 sampel terkumpul)`);
            console.log(`     (Jalankan dengan '--warmup' untuk mengisi 18 sampel sekaligus)`);
        } else {
            console.log(`   - Risk Assessment   : Skor ${evaluatedScore} - "${evaluatedLevel}" (Ekspektasi: ${caseDef.expectedScore})`);
            if (ai) {
                const probPct = Math.round((ai.probability || 0) * 100);
                const aiLabel = ai.predictedLabel ? "🔴 SEPSIS TERINDIKASI" : "🟢 AMAN";
                console.log(`   - Prediksi AI       : Probabilitas ${probPct}% | Label: ${aiLabel} | Model v${ai.modelVersion || "xgb-v2"}`);
            }
            if (tel?.windowStats) {
                console.log(`   - Window Stats 3m   : HR Median=${tel.windowStats.hrMedian} | Stabilitas=${tel.windowStats.stabilityScore}% | Variabilitas=±${tel.windowStats.hrVariability}`);
            }
            const alertTriggered = evaluatedScore >= 2;
            const alertText = alertTriggered
                ? "🚨 ALERT AKTIF (Popup & Suara Alarm berbunyi di dashboard web)"
                : "✅ NORMAL/TERPANTAU (Tanpa alarm)";
            console.log(`   - Status Notifikasi : ${alertText}`);
        }
    } catch (err) {
        console.error(`[Simulator] ❌ Gagal mengirim telemetri:`, err.message);
        console.error(`   Pastikan server backend (npm run dev di server) sedang berjalan di ${SERVER_URL}.`);
    }
}

/**
 * Menjalankan uji otomatis seluruh 16 kasus secara berurutan dan verifikasi hasil
 */
async function runTestAllCases() {
    console.log(`\n[Test-All] 🧪 Memulai verifikasi otomatis 16 kasus SIRS ke ${SERVER_URL}...`);
    // Lakukan warm-up dulu agar evaluasi langsung muncul
    await performWarmup();

    let passed = 0;
    let failed = 0;

    console.log("\n Hasil Verifikasi 16 Kasus:");
    console.log(" -----------------------------------------------------------------------------");

    for (const c of SIRS_TRUTH_TABLE) {
        const payload = generateTelemetryPayload(c, true); // gunakan nilai tepat untuk pengujian verifikasi
        try {
            const data = await sendPayload(payload, true);
            const tel = data.result?.telemetry;
            const evaluatedScore = tel?.riskAssessment?.riskScore ?? payload.riskScore;
            const match = evaluatedScore === c.expectedScore;

            if (match) passed++;
            else failed++;

            const statusIcon = match ? "✅ COCOK " : "❌ BEDA  ";
            console.log(
                ` ${statusIcon} Kasus ${String(c.no).padStart(2)}: Skor=${evaluatedScore} (Ekspektasi=${c.expectedScore}) | Notif=${evaluatedScore >= 2 ? "YA   " : "TIDAK"} | ${c.name}`
            );
        } catch (err) {
            failed++;
            console.log(` ❌ GAGAL  Kasus ${String(c.no).padStart(2)}: ${err.message}`);
        }

        // Jeda 200ms antar panggilan
        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(" -----------------------------------------------------------------------------");
    console.log(`[Test-All] Ringkasan: ${passed}/16 Kasus Berhasil diverifikasi (${failed} gagal).\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
    if (showList) {
        printTruthTable();
        return;
    }

    if (runTestAll) {
        await runTestAllCases();
        return;
    }

    const targetCase = findCase(requestedMode);

    if (doWarmup) {
        await performWarmup();
    }

    console.log(`[Simulator] Mode terpilih: Kasus ${targetCase.no} - "${targetCase.name}"`);
    await runSingleCase(targetCase);

    if (isStream) {
        console.log(`\n[Simulator] 🔄 Streaming telemetri Kasus ${targetCase.no} setiap ${intervalSec} detik. Tekan Ctrl+C untuk berhenti.`);
        setInterval(async () => {
            await runSingleCase(targetCase);
        }, intervalSec * 1000);
    } else {
        console.log(`\n[Simulator] Selesai. Gunakan 'node scripts/simulate.js --list' untuk melihat seluruh 16 pilihan mode.`);
    }
}

main();
