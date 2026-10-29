"""Script Simulator Demo Telemetri untuk Memicu Alert Sepsis & AI Prediction.

Dapat dijalankan langsung dari terminal:
    python simulate.py --mode sepsis    # Memicu Skor 4 (Mohon Diperiksa) & alert merah di web
    python simulate.py --mode attention # Memicu Skor 3 (Perlu Perhatian)
    python simulate.py --mode warning   # Memicu Skor 2 (Waspada - 2 kriteria SIRS)
    python simulate.py --mode watch     # Memicu Skor 1 (Perlu Diamati - 1 kriteria)
    python simulate.py --mode normal    # Mengembalikan ke kondisi normal / Skor 0 (Stabil)
    python simulate.py --motion GERAK   # Mensimulasikan status sensor gerak
    python simulate.py --stream         # Streaming data terus-menerus tiap 3 detik
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


def generate_payload(mode: str, device_id: int, motion: str = "BAIK") -> dict:
    now_ms = int(time.time() * 1000)

    if mode == "sepsis":
        # Kondisi sepsis akut: SEMUA 4 parameter fisiologis di luar rentang normal
        # Skor 4: Mohon Diperiksa
        return {
            "deviceId": device_id,
            "heartRate": random.randint(118, 130),       # Takikardia > 90 bpm
            "spo2": random.randint(89, 93),              # Hipoksia <= 95 %
            "temperature": round(39.1 + random.uniform(0.1, 0.7), 1),  # Demam tinggi > 38.0 °C
            "respiratoryRate": random.randint(26, 32),   # Takipnea > 20 rpm
            "c1_hr": True,
            "c2_rr": True,
            "c3_temp": True,
            "c4_spo2": True,
            "riskScore": 4,
            "signal": "CONNECTED",
            "bpmStatus": motion,
            "tsMs": now_ms,
        }
    elif mode == "attention":
        # 3 parameter abnormal -> Skor 3: Perlu Perhatian
        return {
            "deviceId": device_id,
            "heartRate": random.randint(105, 115),       # Takikardia > 90 bpm
            "spo2": random.randint(97, 99),              # SpO2 normal
            "temperature": round(38.4 + random.uniform(0.1, 0.4), 1),  # Demam > 38.0 °C
            "respiratoryRate": random.randint(22, 26),   # Takipnea > 20 rpm
            "c1_hr": True,
            "c2_rr": True,
            "c3_temp": True,
            "c4_spo2": False,
            "riskScore": 3,
            "signal": "CONNECTED",
            "bpmStatus": motion,
            "tsMs": now_ms,
        }
    elif mode == "warning":
        # 2 parameter abnormal -> Skor 2: Waspada (ambang batas SIRS)
        return {
            "deviceId": device_id,
            "heartRate": random.randint(96, 104),        # Takikardia > 90 bpm
            "spo2": random.randint(96, 98),              # SpO2 normal
            "temperature": round(36.8 + random.uniform(0.1, 0.4), 1),  # Suhu normal
            "respiratoryRate": random.randint(22, 25),   # Takipnea > 20 rpm
            "c1_hr": True,
            "c2_rr": True,
            "c3_temp": False,
            "c4_spo2": False,
            "riskScore": 2,
            "signal": "CONNECTED",
            "bpmStatus": motion,
            "tsMs": now_ms,
        }
    elif mode == "watch":
        # 1 parameter abnormal -> Skor 1: Perlu Diamati
        return {
            "deviceId": device_id,
            "heartRate": random.randint(92, 98),         # Takikardia ringan > 90 bpm
            "spo2": random.randint(97, 99),              # SpO2 normal
            "temperature": round(36.8 + random.uniform(0.1, 0.4), 1),  # Suhu normal
            "respiratoryRate": random.randint(16, 19),   # RR normal
            "c1_hr": True,
            "c2_rr": False,
            "c3_temp": False,
            "c4_spo2": False,
            "riskScore": 1,
            "signal": "CONNECTED",
            "bpmStatus": motion,
            "tsMs": now_ms,
        }
    else:
        # normal: SEMUA parameter fisiologis dalam batas normal
        # Skor 0: Stabil
        return {
            "deviceId": device_id,
            "heartRate": random.randint(70, 78),         # Normal 60-90 bpm
            "spo2": random.randint(98, 100),             # Normal > 95 %
            "temperature": round(36.5 + random.uniform(0.1, 0.4), 1),  # Normal 36-38 °C
            "respiratoryRate": random.randint(14, 18),   # Normal 12-20 rpm
            "c1_hr": False,
            "c2_rr": False,
            "c3_temp": False,
            "c4_spo2": False,
            "riskScore": 0,
            "signal": "CONNECTED",
            "bpmStatus": motion,
            "tsMs": now_ms,
        }


def send_telemetry(mode: str, device_id: int, motion: str = "BAIK"):
    payload = generate_payload(mode, device_id, motion)
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        SERVER_URL,
        data=data_bytes,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            tel = res_body.get("result", {}).get("telemetry", {})
            risk_ass = tel.get("riskAssessment") or {}
            ai = tel.get("aiPrediction") or tel.get("latestAiPrediction") or {}

            score = risk_ass.get("riskScore", payload["riskScore"])
            level = risk_ass.get("riskLevel", "")
            bpm_status_label = tel.get("bpmStatusLabel") or payload.get("bpmStatus", "BAIK")

            print(f"\n[Simulator] Telemetri terkirim untuk Device {device_id} [Mode: {mode.upper()}]:")
            print(f"   - Heart Rate        : {payload['heartRate']} bpm (Status Sensor: {bpm_status_label})")
            print(f"   - Respiratory Rate  : {payload['respiratoryRate']} rpm (C2: {payload['c2_rr']})")
            print(f"   - Temperature       : {payload['temperature']} C (C3: {payload['c3_temp']})")
            print(f"   - SpO2              : {payload['spo2']} % (C4: {payload['c4_spo2']})")
            print(f"   - Risk Assessment   : Skor {score} - \"{level}\"")
            if tel.get("windowStats"):
                ws = tel["windowStats"]
                print(f"   - Window Stats 3m   : HR Median={ws.get('hrMedian')} | Stabilitas={ws.get('stabilityScore')}% | Variabilitas=±{ws.get('hrVariability')}")
            if ai:
                prob_pct = round(ai.get("probability", 0) * 100)
                label_txt = "SEPSIS (MERAH)" if ai.get("predictedLabel") else "AMAN"
                print(f"   - AI Prediction     : Probabilitas {prob_pct}% | Label: {label_txt} | v{ai.get('modelVersion', 'xgb-v2')}")
            alert_status = "[ALERT TRIGGERED] Popup Notifikasi & Suara Alarm Aktif di Dashboard!" if score >= 2 else "[NORMAL] Kondisi aman/terpantau"
            print(f"   - Status Alert      : {alert_status}")

    except Exception as e:
        print(f"[Simulator] Gagal mengirim: {e}")
        print("   Pastikan backend server berjalan di http://localhost:5000.")


def main():
    parser = argparse.ArgumentParser(description="Simulator Telemetri Sensor Demo")
    parser.add_argument(
        "--mode",
        default="sepsis",
        choices=["sepsis", "attention", "warning", "watch", "normal"],
        help="Mode kondisi pasien (sepsis=Skor 4, attention=Skor 3, warning=Skor 2, watch=Skor 1, normal=Skor 0)",
    )
    parser.add_argument("--device", type=int, default=1, help="ID Device / Bed (default: 1)")
    parser.add_argument("--motion", default="BAIK", help="Status gerakan BPM (TIDAK_MENEMPEL, GERAK, BAIK, dll)")
    parser.add_argument("--stream", action="store_true", help="Kirim data berkala")
    parser.add_argument("--interval", type=int, default=3, help="Interval stream dalam detik")
    args = parser.parse_args()

    print(f"[Simulator] Memulai simulasi telemetri ke {SERVER_URL} ...")
    send_telemetry(args.mode, args.device, args.motion.upper())

    if args.stream:
        print(f"\n[Simulator] Streaming telemetri setiap {args.interval} detik. Tekan Ctrl+C untuk berhenti.")
        try:
            while True:
                time.sleep(args.interval)
                send_telemetry(args.mode, args.device, args.motion.upper())
        except KeyboardInterrupt:
            print("\n[Simulator] Streaming dihentikan.")
    else:
        print("\n[Simulator] Selesai. Buka browser di http://localhost:3000 untuk melihat notifikasi popup.")


if __name__ == "__main__":
    main()
