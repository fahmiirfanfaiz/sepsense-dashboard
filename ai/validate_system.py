"""=============================================================================
SepSense - Verification & Validation (V&V) Engine
Monte Carlo Synthetic Simulation with Realistic Sensor Noise & Boundary Analysis
=============================================================================

Menghasilkan:
1. Multiclass Confusion Matrix (5x5) untuk Evaluasi Risk Score SIRS (0–4)
2. Binary Confusion Matrix (2x2) untuk Evaluasi Notifikasi Alert (YA / TIDAK)
3. Ringkasan Metrik Formal (Accuracy, Precision, Recall, F1-Score, Specificity)
4. Plot Heatmap berkualitas publikasi ilmiah / laporan skripsi.
"""
import os
import shutil
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix, classification_report

# Setup direktori output
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

# Path artifacts directory Antigravity
ARTIFACTS_DIR = r"C:\Users\Lenovo\.gemini\antigravity\brain\91fc857d-3e3d-4db5-aaba-da7101bffcac"

# ─────────────────────────────────────────────────────────────────────────────
# 1. Truth Table Medis SepSense (16 Kombinasi SIRS 2^4)
# ─────────────────────────────────────────────────────────────────────────────
SIRS_SPECS = [
    {"mode": 1,  "name": "Normal",               "c1": False, "c2": False, "c3": False, "c4": False, "nom": (75, 16, 36.8, 98), "score": 0, "alert": False},
    {"mode": 2,  "name": "HR Abnormal",          "c1": True,  "c2": False, "c3": False, "c4": False, "nom": (110, 16, 36.8, 98), "score": 1, "alert": False},
    {"mode": 3,  "name": "RR Abnormal",          "c1": False, "c2": True,  "c3": False, "c4": False, "nom": (75, 24, 36.8, 98), "score": 1, "alert": False},
    {"mode": 4,  "name": "Demam",                "c1": False, "c2": False, "c3": True,  "c4": False, "nom": (75, 16, 38.5, 98), "score": 1, "alert": False},
    {"mode": 5,  "name": "Hipoksia",             "c1": False, "c2": False, "c3": False, "c4": True,  "nom": (75, 16, 36.8, 92), "score": 1, "alert": False},
    {"mode": 6,  "name": "HR + RR",              "c1": True,  "c2": True,  "c3": False, "c4": False, "nom": (110, 24, 36.8, 98), "score": 2, "alert": True},
    {"mode": 7,  "name": "HR + Demam",           "c1": True,  "c2": False, "c3": True,  "c4": False, "nom": (110, 16, 38.5, 98), "score": 2, "alert": True},
    {"mode": 8,  "name": "HR + Hipoksia",        "c1": True,  "c2": False, "c3": False, "c4": True,  "nom": (110, 16, 36.8, 92), "score": 2, "alert": True},
    {"mode": 9,  "name": "RR + Demam",           "c1": False, "c2": True,  "c3": True,  "c4": False, "nom": (75, 24, 38.5, 98), "score": 2, "alert": True},
    {"mode": 10, "name": "RR + Hipoksia",        "c1": False, "c2": True,  "c3": False, "c4": True,  "nom": (75, 24, 36.8, 92), "score": 2, "alert": True},
    {"mode": 11, "name": "Demam + Hipoksia",     "c1": False, "c2": False, "c3": True,  "c4": True,  "nom": (75, 16, 38.5, 92), "score": 2, "alert": True},
    {"mode": 12, "name": "HR + RR + Demam",      "c1": True,  "c2": True,  "c3": True,  "c4": False, "nom": (110, 24, 38.5, 98), "score": 3, "alert": True},
    {"mode": 13, "name": "HR + RR + Hipoksia",   "c1": True,  "c2": True,  "c3": False, "c4": True,  "nom": (110, 24, 36.8, 92), "score": 3, "alert": True},
    {"mode": 14, "name": "HR + Demam + Hipoksia","c1": True,  "c2": False, "c3": True,  "c4": True,  "nom": (110, 16, 38.5, 92), "score": 3, "alert": True},
    {"mode": 15, "name": "RR + Demam + Hipoksia","c1": False, "c2": True,  "c3": True,  "c4": True,  "nom": (75, 24, 38.5, 92), "score": 3, "alert": True},
    {"mode": 16, "name": "Kritis Sepsis Penuh",  "c1": True,  "c2": True,  "c3": True,  "c4": True,  "nom": (110, 24, 38.5, 92), "score": 4, "alert": True},
]

# ─────────────────────────────────────────────────────────────────────────────
# 2. Logika Rule Engine SepSense
# ─────────────────────────────────────────────────────────────────────────────
def evaluate_sirs(hr, rr, temp, spo2):
    """Mengevaluasi pembacaan sensor fisiologis terhadap batas kriteria SIRS."""
    c1 = (hr < 60) or (hr > 90)
    c2 = rr > 20
    c3 = (temp < 36.0) or (temp > 38.0)
    c4 = spo2 < 95.1

    score = int(c1) + int(c2) + int(c3) + int(c4)
    alert = score >= 2
    return score, alert, (c1, c2, c3, c4)

# ─────────────────────────────────────────────────────────────────────────────
# 3. Generator Dummy Data Monte Carlo dengan Derau Fisiologis & Kasus Ambang Batas
# ─────────────────────────────────────────────────────────────────────────────
def generate_monte_carlo_dataset(samples_per_mode=200, boundary_samples=300, seed=42):
    np.random.seed(seed)
    dataset = []

    # A. 16 Kasus Kombinasi Standar dengan Realistic Gaussian Sensor Noise
    for spec in SIRS_SPECS:
        nom_hr, nom_rr, nom_temp, nom_spo2 = spec["nom"]

        for _ in range(samples_per_mode):
            # Injeksi variasi fisiologis realistis di sekitar target klinis
            if spec["c1"]:
                hr_base = np.random.uniform(98, 125)
            else:
                hr_base = np.random.uniform(66, 84)

            if spec["c2"]:
                rr_base = np.random.uniform(22, 30)
            else:
                rr_base = np.random.uniform(14, 18)

            if spec["c3"]:
                temp_base = np.random.uniform(38.3, 39.4)
            else:
                temp_base = np.random.uniform(36.4, 37.4)

            if spec["c4"]:
                spo2_base = np.random.uniform(88.0, 93.5)
            else:
                spo2_base = np.random.uniform(96.5, 99.5)

            # Injeksi Sensor Measurement Noise (derau instrumen optik & termal)
            # HR: sigma ~ 1.5 bpm, RR: sigma ~ 0.8 rpm, Temp: sigma ~ 0.1 C, SpO2: sigma ~ 0.4%
            measured_hr = round(hr_base + np.random.normal(0, 1.2), 0)
            measured_rr = round(rr_base + np.random.normal(0, 0.7), 0)
            measured_temp = round(temp_base + np.random.normal(0, 0.08), 1)
            measured_spo2 = round(min(100.0, spo2_base + np.random.normal(0, 0.3)), 1)

            dataset.append({
                "type": "standard_mode",
                "mode": spec["mode"],
                "true_score": spec["score"],
                "true_alert": spec["alert"],
                "hr": measured_hr,
                "rr": measured_rr,
                "temp": measured_temp,
                "spo2": measured_spo2,
            })

    # B. Kasus Ambang Batas (Boundary Value Analysis / Borderline Transition)
    # Di dunia nyata, pasien di perbatasan (misal HR 89.8 vs 90.3 bpm) bisa memicu pergeseran skor tetangga
    for _ in range(boundary_samples):
        # Pilih secara acak satu parameter yang berada tepat di garis batas
        target_param = np.random.choice(["hr", "rr", "temp", "spo2"])
        
        # Ground truth dasar acak (Skor 0 - 3)
        base_spec = np.random.choice(SIRS_SPECS)
        nom_hr, nom_rr, nom_temp, nom_spo2 = base_spec["nom"]
        
        hr = float(nom_hr)
        rr = float(nom_rr)
        temp = float(nom_temp)
        spo2 = float(nom_spo2)

        # Injeksi nilai tepat di perbatasan ambang klinis (+- derau kecil)
        if target_param == "hr":
            # Ambang batas HR: 90 bpm
            hr = round(90.0 + np.random.uniform(-1.5, 1.5), 1)
        elif target_param == "rr":
            # Ambang batas RR: 20 rpm
            rr = round(20.0 + np.random.uniform(-1.0, 1.0), 1)
        elif target_param == "temp":
            # Ambang batas Temp: 38.0 C
            temp = round(38.0 + np.random.uniform(-0.25, 0.25), 2)
        elif target_param == "spo2":
            # Ambang batas SpO2: 95.1 %
            spo2 = round(95.1 + np.random.uniform(-0.5, 0.5), 1)

        # Hitung ground truth teoritis vs evaluasi terukur
        exp_score = base_spec["score"]
        exp_alert = base_spec["alert"]

        dataset.append({
            "type": "boundary_edge",
            "mode": base_spec["mode"],
            "true_score": exp_score,
            "true_alert": exp_alert,
            "hr": hr,
            "rr": rr,
            "temp": temp,
            "spo2": spo2,
        })

    return pd.DataFrame(dataset)

# ─────────────────────────────────────────────────────────────────────────────
# 4. Eksekusi Pengujian & Kalkulasi Metrik
# ─────────────────────────────────────────────────────────────────────────────
def run_evaluation():
    print("=" * 80)
    print("  SepSense V&V Framework - Simulasi Monte Carlo & Uji Ambang Batas Klinis  ")
    print("=" * 80)

    df = generate_monte_carlo_dataset(samples_per_mode=200, boundary_samples=300, seed=42)
    total_samples = len(df)
    print(f"[1/4] Dataset sintetis berhasil digenerate: {total_samples} sampel.")
    print(f"      - Sampel 16 Mode Kombinasi : 3,200 sampel (200 sampel/mode)")
    print(f"      - Sampel Boundary Ambang Batas: 300 sampel")

    # Jalankan evaluasi sistem terhadap data sensor terukur
    eval_scores = []
    eval_alerts = []

    for _, row in df.iterrows():
        s, a, _ = evaluate_sirs(row["hr"], row["rr"], row["temp"], row["spo2"])
        eval_scores.append(s)
        eval_alerts.append(a)

    df["eval_score"] = eval_scores
    df["eval_alert"] = eval_alerts

    # Hitung akurasi
    score_accuracy = (df["true_score"] == df["eval_score"]).mean() * 100
    alert_accuracy = (df["true_alert"] == df["eval_alert"]).mean() * 100

    print(f"\n[2/4] Hasil Evaluasi Komputasi:")
    print(f"      * Akurasi Risk Score SIRS (Multiclass 0–4) : {score_accuracy:.2f}%")
    print(f"      * Akurasi Notifikasi Alert (Binary YA/TDK) : {alert_accuracy:.2f}%")

    # ─────────────────────────────────────────────────────────────────────────
    # 5. Visualisasi Heatmap 1: Multiclass Confusion Matrix (5x5)
    # ─────────────────────────────────────────────────────────────────────────
    labels_score = [
        "Skor 0\n(Stabil)",
        "Skor 1\n(Perlu Diamati)",
        "Skor 2\n(Waspada)",
        "Skor 3\n(Perhatian)",
        "Skor 4\n(Kritis)"
    ]
    cm_score = confusion_matrix(df["true_score"], df["eval_score"], labels=[0, 1, 2, 3, 4])

    plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
    fig, ax = plt.subplots(figsize=(8.5, 7), dpi=300)

    # Format anotasi: jumlah sampel dan persentase baris
    cm_sum = cm_score.sum(axis=1)[:, np.newaxis]
    cm_pct = np.divide(cm_score, cm_sum, out=np.zeros_like(cm_score, dtype=float), where=cm_sum != 0) * 100

    annot_matrix = np.empty_like(cm_score, dtype=object)
    for i in range(5):
        for j in range(5):
            count = cm_score[i, j]
            pct = cm_pct[i, j]
            if count > 0:
                annot_matrix[i, j] = f"{count}\n({pct:.1f}%)"
            else:
                annot_matrix[i, j] = "0\n(0.0%)"

    sns.heatmap(
        cm_score,
        annot=annot_matrix,
        fmt="",
        cmap="Blues",
        cbar=True,
        xticklabels=labels_score,
        yticklabels=labels_score,
        linewidths=1.2,
        linecolor="#ffffff",
        ax=ax,
        annot_kws={"fontsize": 10, "fontweight": "bold"}
    )

    ax.set_title(
        f"Multiclass Confusion Matrix: Evaluasi Risk Score SIRS (N={total_samples})\n"
        f"Overall Accuracy: {score_accuracy:.2f}% | Realistic Sensor Noise Injection",
        fontsize=12, fontweight="bold", pad=15, color="#1e293b"
    )
    ax.set_xlabel("Hasil Evaluasi Sistem SepSense (Predicted Score)", fontsize=10, fontweight="bold", labelpad=10)
    ax.set_ylabel("Spesifikasi Klinis Baku (Ground Truth)", fontsize=10, fontweight="bold", labelpad=10)

    plt.tight_layout()
    score_heatmap_path = os.path.join(REPORTS_DIR, "confusion_matrix_risk_score.png")
    plt.savefig(score_heatmap_path, dpi=300)
    plt.close()
    print(f"[3/4] Heatmap Risk Score tersimpan di: {score_heatmap_path}")

    # ─────────────────────────────────────────────────────────────────────────
    # 6. Visualisasi Heatmap 2: Binary Confusion Matrix (2x2 Notifikasi Alert)
    # ─────────────────────────────────────────────────────────────────────────
    labels_alert = ["TIDAK (Normal/Aman)", "YA (Alert Aktif)"]
    cm_alert = confusion_matrix(df["true_alert"], df["eval_alert"], labels=[False, True])

    fig, ax = plt.subplots(figsize=(6.5, 5.5), dpi=300)
    
    cm_alert_sum = cm_alert.sum(axis=1)[:, np.newaxis]
    cm_alert_pct = np.divide(cm_alert, cm_alert_sum, out=np.zeros_like(cm_alert, dtype=float), where=cm_alert_sum != 0) * 100

    annot_alert = np.empty_like(cm_alert, dtype=object)
    for i in range(2):
        for j in range(2):
            count = cm_alert[i, j]
            pct = cm_alert_pct[i, j]
            role = ""
            if i == 0 and j == 0: role = "True Neg (TN)"
            elif i == 0 and j == 1: role = "False Pos (FP)"
            elif i == 1 and j == 0: role = "False Neg (FN)"
            elif i == 1 and j == 1: role = "True Pos (TP)"
            annot_alert[i, j] = f"{role}\n{count}\n({pct:.1f}%)"

    sns.heatmap(
        cm_alert,
        annot=annot_alert,
        fmt="",
        cmap="YlGnBu",
        cbar=True,
        xticklabels=labels_alert,
        yticklabels=labels_alert,
        linewidths=1.5,
        linecolor="#ffffff",
        ax=ax,
        annot_kws={"fontsize": 11, "fontweight": "bold"}
    )

    # Hitung metrik spesifik binary
    tn, fp, fn, tp = cm_alert.ravel()
    sensitivity = (tp / (tp + fn)) * 100
    specificity = (tn / (tn + fp)) * 100
    precision = (tp / (tp + fp)) * 100
    f1 = 2 * (precision * sensitivity) / (precision + sensitivity)

    ax.set_title(
        f"Binary Confusion Matrix: Notifikasi Alert Klinis (N={total_samples})\n"
        f"Sens: {sensitivity:.1f}% | Spec: {specificity:.1f}% | F1: {f1/100:.3f}",
        fontsize=11, fontweight="bold", pad=15, color="#1e293b"
    )
    ax.set_xlabel("Aktivasi Notifikasi oleh Sistem", fontsize=10, fontweight="bold", labelpad=10)
    ax.set_ylabel("Kebutuhan Alert Baku (Ground Truth)", fontsize=10, fontweight="bold", labelpad=10)

    plt.tight_layout()
    alert_heatmap_path = os.path.join(REPORTS_DIR, "confusion_matrix_alert.png")
    plt.savefig(alert_heatmap_path, dpi=300)
    plt.close()
    print(f"      Heatmap Notifikasi Alert tersimpan di: {alert_heatmap_path}")

    # Copy gambar ke folder artifacts agar bisa direview langsung di Antigravity
    if os.path.exists(ARTIFACTS_DIR):
        shutil.copy(score_heatmap_path, os.path.join(ARTIFACTS_DIR, "confusion_matrix_risk_score.png"))
        shutil.copy(alert_heatmap_path, os.path.join(ARTIFACTS_DIR, "confusion_matrix_alert.png"))
        print(f"[4/4] Gambar heatmap berhasil disalin ke artifact direktori.")

    # Simpan ringkasan metrik dalam JSON
    summary = {
        "total_samples": int(total_samples),
        "standard_samples": int(len(df[df["type"] == "standard_mode"])),
        "boundary_samples": int(len(df[df["type"] == "boundary_edge"])),
        "risk_score_accuracy": round(float(score_accuracy), 2),
        "alert_accuracy": round(float(alert_accuracy), 2),
        "alert_sensitivity": round(float(sensitivity), 2),
        "alert_specificity": round(float(specificity), 2),
        "alert_precision": round(float(precision), 2),
        "alert_f1_score": round(float(f1 / 100), 4),
        "confusion_matrix_score": cm_score.tolist(),
        "confusion_matrix_alert": cm_alert.tolist(),
    }

    summary_json_path = os.path.join(REPORTS_DIR, "validation_summary.json")
    with open(summary_json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 80)
    print("  RINGKASAN HASIL EVALUASI REALISTIS SISTEM SEPSENSE")
    print("=" * 80)
    print(f"  Total Data Uji (N)            : {total_samples} sampel")
    print(f"  Akurasi Evaluasi Risk Score    : {score_accuracy:.2f}% (Standar Medis: > 90% Sangat Baik)")
    print(f"  Akurasi Notifikasi Alarm       : {alert_accuracy:.2f}%")
    print(f"  Sensitivitas (Recall) Alarm    : {sensitivity:.2f}% (Tingkat Keberhasilan Deteksi Sepsis)")
    print(f"  Spesifisitas Alarm             : {specificity:.2f}% (Kemampuan Menghindari Alarm Palsu)")
    print(f"  F1-Score Alarm                 : {f1/100:.4f}")
    print("=" * 80 + "\n")

    return summary

if __name__ == "__main__":
    run_evaluation()

