# SepSense — IoT-Enabled Real-Time Sepsis Early Warning & Clinical Monitoring System

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Express.js](https://img.shields.io/badge/Backend-Express%205-lightgrey?style=flat&logo=express)](https://expressjs.com/)
[![FastAPI](https://img.shields.io/badge/AI%20Microservice-FastAPI-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![XGBoost](https://img.shields.io/badge/Model-XGBoost-orange?style=flat)](https://xgboost.readthedocs.io/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%20PostgreSQL-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![MQTT](https://img.shields.io/badge/IoT-MQTT%20Protocol-660066?style=flat&logo=eclipse-mosquitto)](https://mqtt.org/)

**SepSense** adalah platform pemantauan pasien multi-bed terintegrasi berbasis Internet of Things (IoT) dan Artificial Intelligence (AI) yang dirancang untuk mendeteksi tanda-tanda awal sindrom respons inflamasi sistemik (*Systemic Inflammatory Response Syndrome* / SIRS) dan risiko sepsis secara *real-time* di lingkungan ruang rawat intensif (ICU / HCU).

Sistem ini menggabungkan dua mesin evaluasi komplementer (*dual-engine*): **Deterministic SIRS Clinical Rule Engine** untuk kepatuhan baku medis dan **Machine Learning (XGBoost)** untuk klasifikasi risiko sepsis dari dinamika tanda vital fisiologis.

---

## 📑 Daftar Isi

- [Arsitektur Sistem](#-arsitektur-sistem)
- [Fitur Utama](#-fitur-utama)
- [Spesifikasi Klinis Baku (SIRS)](#-spesifikasi-klinis-baku-sirs)
- [Struktur Repositori](#-struktur-repositori)
- [Prasyarat Instalasi](#-prasyarat-instalasi)
- [Panduan Menjalankan Sistem](#-panduan-menjalankan-sistem)
- [Simulator Telemetri Sensor](#-simulator-telemetri-sensor)
- [Verifikasi & Validasi Ilmiah](#-verifikasi--validasi-ilmiah)

---

## 🏛 Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      HARDWARE LAYER (BEDSIDE IOT)                       │
│  [MAX30102: HR & SpO2]  [MPU6050: Laju Napas]  [MLX90614: Suhu Tubuh]   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ MQTT Topic: sepsense/{deviceId}/telemetry
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    INGESTION & BACKEND (EXPRESS 5)                      │
│  - MQTT Ingestion Handler & Signal Quality Filter                       │
│  - 3-Minute (18 Samples) Moving Window Median Filter & Gatekeeper       │
│  - Deterministic SIRS Rule Evaluator (0 - 3 Skor Fisiologis)            │
│  - Prisma ORM & PostgreSQL (Audit Trail, Sesi, Vital Readings)          │
└──────────────────┬──────────────────────────────────┬───────────────────┘
                   │ HTTP /predict/realtime           │ WebSocket (Socket.IO)
                   ▼                                  ▼
┌─────────────────────────────────────┐ ┌─────────────────────────────────┐
│        AI MICROSERVICE (FASTAPI)    │ │    WEB DASHBOARD (NEXT.JS 15)   │
│  - XGBoost Classifier (PhysioNet)   │ │  - Multi-Bed Overview Table     │
│  - 44 Time-Series Features Engine   │ │  - Real-Time Time-Series Charts │
│  - Missing Values Robust Handling   │ │  - Dual Status (SIRS & AI Card) │
│  - Clinical Prob. Harmonization     │ │  - Audio & Toast Popup Alert    │
└─────────────────────────────────────┘ └─────────────────────────────────┘
```

---

## 🌟 Fitur Utama

1. **Dual-Engine Sepsis Detection:**
   - **Mesin Aturan Klinis SIRS:** Menghitung skor keparahan berdasarkan 3 parameter terkalibrasi (Heart Rate, Respiratory Rate, Temperature), dengan SpO₂ ditampilkan secara transparan sebagai estimasi.
   - **Mesin Prediksi AI XGBoost:** Mengidentifikasi probabilitas risiko sepsis dengan model yang dilatih dari dataset klinis PhysioNet Challenge 2019.
2. **Mitigasi Derau & Pencegahan Alarm Palsu (*Noise & Artifact Mitigation*):**
   - **Gerbang Warm-up 3 Menit (18 Sampel):** Menghilangkan fluktuasi transien saat sensor baru dipasang.
   - **Agregasi Berbasis Median:** Kebal terhadap *outlier* dan lonjakan sinyal mendadak dibanding rata-rata biasa (*mean*).
   - **Filter Kualitas Gerakan BPM:** Menyaring data saat sensor lepas (*TIDAK_MENEMPEL*), jenuh (*SINYAL_JENUH*), atau pasien bergerak (*GERAK*).
   - **Thermal Sensor Stabilization (`tempWarm`):** Mencegah pembacaan suhu mentah memicu alarm hipotermia sebelum sensor mencapai kestabilan termal (10 menit).
3. **Peringatan Audio & Visual Real-Time:**
   - Pop-up toast darurat dan suara sirene otomatis menyala saat skor $\ge 2$ (*Waspada / Periksa*).
4. **Grafik Sensor Time-Series Interaktif:**
   - Grafik garis langsung (Chart.js) dilengkapi garis batas acuan normal (*reference horizontal lines*).
5. **Manajemen Bed & Pasien Fleksibel (CRUD):**
   - Memungkinkan tenaga kesehatan mengedit nama bed, nomor rekam medis, ruangan, dan identitas pasien secara langsung dari UI.

---

## 🩺 Spesifikasi Klinis Baku (SIRS)

Rentang fisiologis yang diimplementasikan pada sistem SepSense:

| Parameter Fisiologis | Sensor | Rentang Normal | Kriteria Abnormal SIRS | Status Skor |
| :--- | :--- | :---: | :---: | :---: |
| **Heart Rate (HR)** | MAX30102 | **60 – 90 bpm** | $< 60$ atau $> 90\text{ bpm}$ | $C_1$ (Bobot: 1) |
| **Respiratory Rate (RR)** | MPU6050 | **12 – 20 rpm** | $> 20\text{ rpm}$ | $C_2$ (Bobot: 1) |
| **Temperature** | MLX90614 | **36.0 – 38.0 °C** | $< 36.0$ atau $> 38.0\ ^\circ\text{C}$ | $C_3$ (Bobot: 1) |
| **SpO₂ (Estimasi)** | MAX30102 | **95.1 – 100 %** | $< 95.1\%$ *(Hanya estimasi)* | Ditampilkan, non-skor |

### Klasifikasi Tingkat Risiko (0 – 3)
* **Skor 0:** **Kondisi Stabil** 🟢 (Semua parameter terkalibrasi normal)
* **Skor 1:** **Perlu Diamati** 🔵 (1 parameter abnormal, belum memenuhi kriteria sepsis SIRS)
* **Skor 2:** **Waspada** 🟠 (2 parameter abnormal — **Alert Klinis & Sirene Aktif**)
* **Skor 3:** **Perlu Perhatian / Kritis** 🔴 (3 parameter abnormal — **Alert Klinis Prioritas Tinggi**)

---

## 📂 Struktur Repositori

```
Capstone/
├── ai/                          # Microservice Machine Learning (Python / FastAPI)
│   ├── features.py              # Ekstraksi 44 fitur time-series & rolling window
│   ├── main.py                  # Layanan FastAPI (/predict/realtime & /predict/window)
│   ├── train.py                 # Pelatihan model XGBoost + GroupKFold 5-Fold
│   ├── simulate.py              # Simulator telemetri Python (16 kombinasi kasus)
│   ├── validate_system.py       # Script verifikasi Monte Carlo & generator Confusion Matrix
│   ├── data/                    # Dataset klinis pelatihan (PhysioNet 2019)
│   └── models/                  # Artefak model serial (sepsis_xgb.joblib)
├── client/                      # Frontend Web Dashboard (Next.js 15, Tailwind, Chart.js)
│   ├── src/app/                 # Halaman utama (Daftar Bed) & detail (/dashboard/[deviceId])
│   ├── src/components/          # SensorChart, AlertNotification, Sidebar, Navbar
│   └── public/                  # Aset visual & logo SepSense
├── server/                      # Ingestion & API Gateway (Node.js Express 5, Prisma)
│   ├── scripts/simulate.js      # Simulator telemetri sensor Node.js (Truth Table 16 Mode)
│   ├── src/handlers/            # mqttHandler.js (ingestion, warm-up gate, rule engine)
│   ├── src/controllers/         # Dashboard & Bed CRUD controllers
│   ├── src/prisma/              # Skema database & migrasi (contract.prisma)
│   └── src/configs/             # Konfigurasi Socket.IO, MQTT, Express
└── docs/                        # Dokumentasi teknis & panduan sidang/expo
```

---

## 🚀 Panduan Menjalankan Sistem

### 1. Prasyarat Lingkungan
* **Node.js** v20+ dan npm
* **Python** 3.10+ (dengan virtual environment)
* **PostgreSQL** Database aktif
* **Mosquitto** MQTT Broker (opsional jika menggunakan simulator internal)

---

### 2. Menjalankan Backend Server
```bash
cd server
npm install
npm run dev
```
*Backend berjalan di:* `http://localhost:5000`

---

### 3. Menjalankan Frontend Dashboard
```bash
cd client
npm install
npm run dev
```
*Frontend berjalan di:* `http://localhost:3000`

---

### 4. Menjalankan Microservice AI (FastAPI)
```bash
cd ai
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*Dokumentasi Swagger API AI:* `http://localhost:8000/docs`

---

## 🧪 Simulator Telemetri Sensor

Untuk menguji seluruh kemungkinan klinis tanpa memerlukan perangkat keras fisik, gunakan script simulator:

```bash
cd server

# Tampilkan tabel truth table 16 kombinasi kasus
node scripts/simulate.js --list

# Uji Kasus 1: Kondisi Normal (Skor 0 - Stabil)
node scripts/simulate.js --mode 1 --warmup

# Uji Kasus 6: Takikardia + Takipnea (Skor 2 - Waspada -> Alert Bunyi)
node scripts/simulate.js --mode 6 --warmup

# Uji Kasus 12: Takikardia + Takipnea + Demam (Skor 3 - Perhatian)
node scripts/simulate.js --mode 12 --warmup

# Mode Streaming Berkelanjutan (Simulasi Sensor Aktif Setiap 3 Detik)
node scripts/simulate.js --mode 6 --stream --interval 3

# Uji Verifikasi Otomatis Seluruh 16 Kasus
node scripts/simulate.js --test-all
```

---

## 📊 Verifikasi & Validasi Ilmiah

Sistem telah diuji menggunakan **Simulasi Monte Carlo ($N = 3.500$ sampel)** dengan injeksi derau fisiologis Gaussian dan *Boundary Value Analysis* di sekitar nilai ambang batas kritis:

* **Akurasi Evaluasi Risk Score SIRS:** **$95.66\%$**
* **Akurasi Notifikasi Alarm:** **$98.54\%$**
* **Sensitivitas / Recall Alarm:** **$98.72\%$**
* **Spesifisitas Alarm:** **$98.15\%$**
* **F1-Score Alarm:** **$0.9894$**

Grafik Confusion Matrix Heatmap beresolusi tinggi tersedia di direktori `ai/reports/`.

---

## 👥 Tim Pengembang
Proyek Capstone — Sistem Monitoring Risiko Sepsis Terintegrasi IoT & AI (SepSense).

