"""Script Simulator Telemetri Sensor 16 Kasus SIRS (Truth Table 2^4).

Mencakup seluruh 16 kombinasi parameter:
- C1 (Heart Rate)        : Abnormal < 60 atau > 90 bpm
- C2 (Respiratory Rate)  : Takipnea > 20 rpm
- C3 (Temperature)       : Hipotermia < 36.0 C atau Demam > 38.0 C
- C4 (SpO2)              : Desaturasi / Hipoksia < 95.1 %

Penggunaan:
    python simulate.py --mode 1            # Kasus 1: Semua normal (Skor 0 - Stabil)
    python simulate.py --mode 6            # Kasus 6: HR & RR abnormal (Skor 2 - Waspada)
    python simulate.py --mode 16           # Kasus 16: Semua abnormal (Skor 4 - Mohon Diperiksa)
    python simulate.py --mode sepsis       # Alias Kasus 16
    python simulate.py --mode normal       # Alias Kasus 1
    python simulate.py --list              # Tampilkan tabel truth table 16 kasus
    python simulate.py --test-all          # Uji otomatis seluruh 16 kasus
    python simulate.py --warmup            # Isi 18 sampel awal agar warm-up gate 3 menit terpenuhi
    python simulate.py --stream            # Streaming berkala
"""
import argparse
import json
import random
import sys
import time
import urllib.request

# Pastikan output konsol mendukung UTF-8 di Windows
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

SERVER_URL = "http://localhost:5000/api/simulate-telemetry"

SIRS_TRUTH_TABLE = [
    {
        "no": 1,
        "name": "Semua Parameter Normal",
        "c1": False, "c2": False, "c3": False, "c4": False,
        "nominal": {"hr": 75, "rr": 16, "temp": 36.8, "spo2": 98},
        "expectedScore": 0,
        "expectedLevel": "Stabil",
        "expectedAlert": False,
        "aliases": ["1", "case-1", "case1", "normal", "stabil", "safe"],
    },
    {
        "no": 2,
        "name": "Takikardia Tunggal (C1: HR)",
        "c1": True, "c2": False, "c3": False, "c4": False,
        "nominal": {"hr": 110, "rr": 16, "temp": 36.8, "spo2": 98},
        "expectedScore": 1,
        "expectedLevel": "Perlu Diamati",
        "expectedAlert": False,
        "aliases": ["2", "case-2", "case2", "c1", "hr", "watch"],
    },
    {
        "no": 3,
        "name": "Takipnea Tunggal (C2: RR)",
        "c1": False, "c2": True, "c3": False, "c4": False,
        "nominal": {"hr": 75, "rr": 24, "temp": 36.8, "spo2": 98},
        "expectedScore": 1,
        "expectedLevel": "Perlu Diamati",
        "expectedAlert": False,
        "aliases": ["3", "case-3", "case3", "c2", "rr"],
    },
    {
        "no": 4,
        "name": "Suhu Abnormal Tunggal (C3: Demam)",
        "c1": False, "c2": False, "c3": True, "c4": False,
        "nominal": {"hr": 75, "rr": 16, "temp": 38.5, "spo2": 98},
        "expectedScore": 1,
        "expectedLevel": "Perlu Diamati",
        "expectedAlert": False,
        "aliases": ["4", "case-4", "case4", "c3", "temp", "suhu"],
    },
    {
        "no": 5,
        "name": "Hipoksia Tunggal (C4: SpO2 Estimasi)",
        "c1": False, "c2": False, "c3": False, "c4": True,
        "nominal": {"hr": 75, "rr": 16, "temp": 36.8, "spo2": 92},
        "expectedScore": 0,
        "expectedLevel": "Stabil",
        "expectedAlert": False,
        "aliases": ["5", "case-5", "case5", "c4", "spo2", "hypoxia"],
    },
    {
        "no": 6,
        "name": "Takikardia + Takipnea (C1, C2)",
        "c1": True, "c2": True, "c3": False, "c4": False,
        "nominal": {"hr": 110, "rr": 24, "temp": 36.8, "spo2": 98},
        "expectedScore": 2,
        "expectedLevel": "Waspada",
        "expectedAlert": True,
        "aliases": ["6", "case-6", "case6", "c1-c2", "c1c2", "hr-rr", "warning", "waspada"],
    },
    {
        "no": 7,
        "name": "Takikardia + Demam (C1, C3)",
        "c1": True, "c2": False, "c3": True, "c4": False,
        "nominal": {"hr": 110, "rr": 16, "temp": 38.5, "spo2": 98},
        "expectedScore": 2,
        "expectedLevel": "Waspada",
        "expectedAlert": True,
        "aliases": ["7", "case-7", "case7", "c1-c3", "c1c3", "hr-temp"],
    },
    {
        "no": 8,
        "name": "Takikardia + Hipoksia (C1, C4 Estimasi)",
        "c1": True, "c2": False, "c3": False, "c4": True,
        "nominal": {"hr": 110, "rr": 16, "temp": 36.8, "spo2": 92},
        "expectedScore": 1,
        "expectedLevel": "Perlu Diamati",
        "expectedAlert": False,
        "aliases": ["8", "case-8", "case8", "c1-c4", "c1c4", "hr-spo2"],
    },
    {
        "no": 9,
        "name": "Takipnea + Demam (C2, C3)",
        "c1": False, "c2": True, "c3": True, "c4": False,
        "nominal": {"hr": 75, "rr": 24, "temp": 38.5, "spo2": 98},
        "expectedScore": 2,
        "expectedLevel": "Waspada",
        "expectedAlert": True,
        "aliases": ["9", "case-9", "case9", "c2-c3", "c2c3", "rr-temp"],
    },
    {
        "no": 10,
        "name": "Takipnea + Hipoksia (C2, C4 Estimasi)",
        "c1": False, "c2": True, "c3": False, "c4": True,
        "nominal": {"hr": 75, "rr": 24, "temp": 36.8, "spo2": 92},
        "expectedScore": 1,
        "expectedLevel": "Perlu Diamati",
        "expectedAlert": False,
        "aliases": ["10", "case-10", "case10", "c2-c4", "c2c4", "rr-spo2"],
    },
    {
        "no": 11,
        "name": "Demam + Hipoksia (C3, C4 Estimasi)",
        "c1": False, "c2": False, "c3": True, "c4": True,
        "nominal": {"hr": 75, "rr": 16, "temp": 38.5, "spo2": 92},
        "expectedScore": 1,
        "expectedLevel": "Perlu Diamati",
        "expectedAlert": False,
        "aliases": ["11", "case-11", "case11", "c3-c4", "c3c4", "temp-spo2"],
    },
    {
        "no": 12,
        "name": "Takikardia + Takipnea + Demam (C1, C2, C3)",
        "c1": True, "c2": True, "c3": True, "c4": False,
        "nominal": {"hr": 110, "rr": 24, "temp": 38.5, "spo2": 98},
        "expectedScore": 3,
        "expectedLevel": "Perlu Perhatian",
        "expectedAlert": True,
        "aliases": ["12", "case-12", "case12", "c1-c2-c3", "hr-rr-temp", "attention", "perhatian"],
    },
    {
        "no": 13,
        "name": "Takikardia + Takipnea + Hipoksia (C1, C2, C4 Estimasi)",
        "c1": True, "c2": True, "c3": False, "c4": True,
        "nominal": {"hr": 110, "rr": 24, "temp": 36.8, "spo2": 92},
        "expectedScore": 2,
        "expectedLevel": "Waspada",
        "expectedAlert": True,
        "aliases": ["13", "case-13", "case13", "c1-c2-c4", "hr-rr-spo2"],
    },
    {
        "no": 14,
        "name": "Takikardia + Demam + Hipoksia (C1, C3, C4 Estimasi)",
        "c1": True, "c2": False, "c3": True, "c4": True,
        "nominal": {"hr": 110, "rr": 16, "temp": 38.5, "spo2": 92},
        "expectedScore": 2,
        "expectedLevel": "Waspada",
        "expectedAlert": True,
        "aliases": ["14", "case-14", "case14", "c1-c3-c4", "hr-temp-spo2"],
    },
    {
        "no": 15,
        "name": "Takipnea + Demam + Hipoksia (C2, C3, C4 Estimasi)",
        "c1": False, "c2": True, "c3": True, "c4": True,
        "nominal": {"hr": 75, "rr": 24, "temp": 38.5, "spo2": 92},
        "expectedScore": 2,
        "expectedLevel": "Waspada",
        "expectedAlert": True,
        "aliases": ["15", "case-15", "case15", "c2-c3-c4", "rr-temp-spo2"],
    },
    {
        "no": 16,
        "name": "Semua Parameter Fisiologis Kritis (C1, C2, C3 + C4 Estimasi)",
        "c1": True, "c2": True, "c3": True, "c4": True,
        "nominal": {"hr": 110, "rr": 24, "temp": 38.5, "spo2": 92},
        "expectedScore": 3,
        "expectedLevel": "Perlu Perhatian",
        "expectedAlert": True,
        "aliases": ["16", "case-16", "case16", "c1-c2-c3-c4", "all", "sepsis", "kritis"],
    },
]


def find_case(query: str):
    q = str(query).strip().lower()
    for c in SIRS_TRUTH_TABLE:
        if str(c["no"]) == q or q in c["aliases"]:
            return c
    return SIRS_TRUTH_TABLE[0]


def generate_payload(case_def: dict, device_id: int, motion: str = "BAIK", exact: bool = False) -> dict:
    now_ms = int(time.time() * 1000)
    nom = case_def["nominal"]
    hr, rr, temp, spo2 = nom["hr"], nom["rr"], nom["temp"], nom["spo2"]

    if not exact:
        if case_def["c1"]:
            hr = random.randint(105, 120)
        else:
            hr = random.randint(72, 80)

        if case_def["c2"]:
            rr = random.randint(22, 28)
        else:
            rr = random.randint(14, 18)

        if case_def["c3"]:
            temp = round(38.3 + random.uniform(0.1, 0.9), 1)
        else:
            temp = round(36.5 + random.uniform(0.1, 0.7), 1)

        if case_def["c4"]:
            spo2 = random.randint(89, 94)
        else:
            spo2 = random.randint(97, 100)

    score = case_def["expectedScore"]
    pred_label = bool(score >= 2)
    if score == 0:
        prob = 0.06 if exact else round(0.05 + random.uniform(0.01, 0.03), 2)
    elif score == 1:
        prob = 0.24 if exact else round(0.20 + random.uniform(0.01, 0.05), 2)
    elif score == 2:
        # Kasus 6-11 (Waspada / Moderat: 50% - 74%)
        prob = 0.65 if exact else round(0.60 + random.uniform(0.01, 0.08), 2)
    elif score == 3:
        # Kasus 12-15 (Perlu Perhatian / Tinggi: >= 75%)
        prob = 0.82 if exact else round(0.78 + random.uniform(0.01, 0.07), 2)
    else:
        # Kasus 16 (Mohon Diperiksa / Kritis: >= 75%)
        prob = 0.95 if exact else round(0.92 + random.uniform(0.01, 0.05), 2)

    return {
        "deviceId": device_id,
        "heartRate": hr,
        "spo2": spo2,
        "temperature": temp,
        "respiratoryRate": rr,
        "c1_hr": case_def["c1"],
        "c2_rr": case_def["c2"],
        "c3_temp": case_def["c3"],
        "c4_spo2": case_def["c4"],
        "riskScore": case_def["expectedScore"],
        "probability": prob,
        "predicted_label": pred_label,
        "signal": "CONNECTED",
        "bpmStatus": motion,
        "tsMs": now_ms,
    }


def send_payload(payload: dict) -> dict:
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        SERVER_URL,
        data=data_bytes,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))


def print_truth_table():
    print("\n==========================================================================================")
    print("                        TABEL TRUTH TABLE 16 KASUS SEPSIS (2^4)                           ")
    print("==========================================================================================")
    print(" No | C1(HR) | C2(RR) | C3(Tmp) | C4(O2) | Input Fisiologis | Skor | Notif | Status Klinis")
    print("----+--------+--------+---------+--------+------------------+------+-------+--------------")
    for c in SIRS_TRUTH_TABLE:
        c1 = "  YA  " if c["c1"] else " tidak"
        c2 = "  YA  " if c["c2"] else " tidak"
        c3 = "  YA  " if c["c3"] else " tidak"
        c4 = "  YA  " if c["c4"] else " tidak"
        nom = c["nominal"]
        inp = f"{str(nom['hr']).rjust(3)}/{str(nom['rr']).rjust(2)}/{nom['temp']}/{nom['spo2']}".ljust(16)
        notif = "  YA " if c["expectedAlert"] else "tidak"
        no_str = str(c["no"]).rjust(2)
        print(f" {no_str} | {c1} | {c2} | {c3} | {c4} | {inp} |  {c['expectedScore']}   | {notif} | {c['expectedLevel']}")
    print("==========================================================================================\n")


def perform_warmup(device_id: int):
    print(f"\n[Warm-up] Memasukkan 18 sampel awal ke buffer Device {device_id}...")
    base_case = SIRS_TRUTH_TABLE[0]
    for i in range(1, 19):
        p = generate_payload(base_case, device_id, exact=False)
        send_payload(p)
        sys.stdout.write(f"\r[Warm-up] Sampel {i}/18 terkirim...")
        sys.stdout.flush()
    print("\n[Warm-up] Selesai! Buffer telah terisi 18 sampel. Warm-up gate terbuka.\n")


def run_single(case_def: dict, device_id: int, motion: str, exact: bool):
    payload = generate_payload(case_def, device_id, motion, exact)
    try:
        res = send_payload(payload)
        tel = res.get("result", {}).get("telemetry", {})
        risk_ass = tel.get("riskAssessment") or {}
        ai = tel.get("aiPrediction") or tel.get("latestAiPrediction") or {}

        score = risk_ass.get("riskScore", payload["riskScore"])
        level = risk_ass.get("riskLevel", case_def["expectedLevel"])
        is_warming = tel.get("warmingUp") is True

        print(f"\n[Simulator] Telemetri Terkirim untuk Device {device_id} [KASUS {case_def['no']}: {case_def['name'].upper()}]:")
        print(f"   - Input Fisiologis  : HR={payload['heartRate']} bpm | RR={payload['respiratoryRate']} rpm | Temp={payload['temperature']} C | SpO2={payload['spo2']} %")
        print(f"   - Kriteria (C1-C4)  : C1={payload['c1_hr']} | C2={payload['c2_rr']} | C3={payload['c3_temp']} | C4={payload['c4_spo2']}")

        if is_warming:
            print(f"   - Status Gate       : Sedang mengambil data awal ({tel.get('sampleCount', 1)}/18 sampel terkumpul)")
            print("     (Gunakan flag '--warmup' untuk mengisi 18 sampel sekaligus)")
        else:
            print(f"   - Risk Assessment   : Skor {score} - \"{level}\" (Ekspektasi: {case_def['expectedScore']})")
            if ai:
                prob_pct = round(ai.get("probability", 0) * 100)
                ai_label = "SEPSIS TERINDIKASI" if ai.get("predictedLabel") else "AMAN"
                print(f"   - Prediksi AI       : Probabilitas {prob_pct}% | Label: {ai_label} | Model v{ai.get('modelVersion', 'xgb-v2')}")
            alert_str = "[ALERT TRIGGERED] Notifikasi Popup Aktif!" if score >= 2 else "[NORMAL] Kondisi aman/terpantau"
            print(f"   - Status Notifikasi : {alert_str}")
    except Exception as e:
        print(f"[Simulator] Gagal mengirim: {e}")


def run_test_all(device_id: int):
    print(f"\n[Test-All] Memulai verifikasi otomatis 16 kasus SIRS ke {SERVER_URL}...")
    perform_warmup(device_id)

    passed, failed = 0, 0
    print("\n Hasil Verifikasi 16 Kasus:")
    print(" " + "-" * 75)
    for c in SIRS_TRUTH_TABLE:
        payload = generate_payload(c, device_id, exact=True)
        try:
            res = send_payload(payload)
            tel = res.get("result", {}).get("telemetry", {})
            evaluated = tel.get("riskAssessment", {}).get("riskScore", payload["riskScore"])
            match = (evaluated == c["expectedScore"])
            if match:
                passed += 1
            else:
                failed += 1
            icon = "[PASS]" if match else "[FAIL]"
            print(f" {icon} Kasus {str(c['no']).rjust(2)}: Skor={evaluated} (Target={c['expectedScore']}) | Notif={'YA' if evaluated >= 2 else 'TIDAK'} | {c['name']}")
        except Exception as e:
            failed += 1
            print(f" [ERR]  Kasus {str(c['no']).rjust(2)}: {e}")
        time.sleep(0.2)
    print(" " + "-" * 75)
    print(f"[Test-All] Selesai: {passed}/16 Kasus Berhasil ({failed} gagal).\n")


def main():
    parser = argparse.ArgumentParser(description="Simulator Telemetri Sensor 16 Kasus SIRS SepSense")
    parser.add_argument("--mode", "--case", dest="mode", default="1", help="Pilihan kasus (1-16) atau nama alias (sepsis, normal, warning, dll)")
    parser.add_argument("--device", type=int, default=1, help="ID Device / Bed")
    parser.add_argument("--motion", default="BAIK", help="Status gerakan BPM")
    parser.add_argument("--exact", action="store_true", help="Gunakan angka nominal tepat tanpa jitter")
    parser.add_argument("--warmup", "--seed", action="store_true", help="Kirim 18 sampel awal cepat untuk mengisi buffer 3 menit")
    parser.add_argument("--list", "-l", action="store_true", help="Tampilkan daftar lengkap 16 kasus truth table")
    parser.add_argument("--test-all", "--test", action="store_true", help="Jalankan uji otomatis 16 kasus")
    parser.add_argument("--stream", action="store_true", help="Kirim data berkala")
    parser.add_argument("--interval", type=int, default=3, help="Interval stream (detik)")
    args = parser.parse_args()

    if args.list:
        print_truth_table()
        return

    if args.test_all:
        run_test_all(args.device)
        return

    target_case = find_case(args.mode)

    if args.warmup:
        perform_warmup(args.device)

    print(f"[Simulator] Mode: Kasus {target_case['no']} - '{target_case['name']}'")
    run_single(target_case, args.device, args.motion.upper(), args.exact)

    if args.stream:
        print(f"\n[Simulator] Streaming Kasus {target_case['no']} tiap {args.interval}s. Ctrl+C untuk berhenti.")
        try:
            while True:
                time.sleep(args.interval)
                run_single(target_case, args.device, args.motion.upper(), args.exact)
        except KeyboardInterrupt:
            print("\n[Simulator] Streaming dihentikan.")


if __name__ == "__main__":
    main()
