# Sepsense AI Service

Model Machine Learning (XGBoost) untuk mengklasifikasi risiko sepsis dari 4 tanda vital sensor fisiologis (Heart Rate dari MAX30102, SpO2 dari MAX30102, Suhu dari MLX90614, dan Laju Pernapasan dari MPU6050) yang dibungkus dengan FastAPI sebagai microservice API.

## Struktur Direktori

```
ai/
├── features.py        # Feature engineering (rolling stats, deltas, SIRS flags, real-time buffer)
├── train.py           # Pelatihan model XGBoost + GroupKFold 5-fold + kalibrasi isotonik
├── main.py            # Entrypoint layanan FastAPI (/health, /predict/realtime, /predict/window)
├── requirements.txt   # Dependensi Python
├── data/
│   └── dataset.csv    # Dataset PhysioNet Challenge 2019
└── models/
    ├── sepsis_xgb.joblib  # Artefak model terlatih, kalibrator, dan ambang optimal
    └── metrics.json       # Laporan metrik evaluasi perbandingan model vs SIRS
```

## 1. Pasang Dependensi

```bash
python -m venv .venv
source .venv/Scripts/activate  # atau .\.venv\Scripts\Activate.ps1 di PowerShell
pip install -r requirements.txt
```

## 2. Latih Model (from scratch)

```bash
python train.py --csv data/dataset.csv --out models
```

Opsi: `--folds 5` (GroupKFold per patient), `--seed 42`.

Keluaran di `models/`:
- `sepsis_xgb.joblib`: Model XGBoost terlatih, Isotonic calibrator, threshold F2 optimal, metadata fitur.
- `metrics.json`: Hasil benchmark evaluasi cross-validation per pasien dan perbandingan dengan aturan SIRS.

## 3. Jalankan Layanan FastAPI (Entrypoint: `main.py`)

Aplikasi dijalankan langsung menggunakan FastAPI CLI atau Uvicorn:

```bash
fastapi dev main.py
# atau
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Dokumentasi interaktif Swagger UI tersedia di `http://localhost:8000/docs`.

## 4. Endpoint API

### `POST /predict/realtime` (Sensor IoT Real-Time)

Menerima pembacaan instan dari sensor IoT:

```bash
curl -X POST http://localhost:8000/predict/realtime \
  -H "Content-Type: application/json" \
  -d '{
    "heart_rate": 118.0,
    "spo2": 92.0,
    "temperature": 39.1,
    "respiratory_rate": 26.0
  }'
```

**Respons JSON:**
```json
{
  "probability": 0.0753,
  "predicted_label": true,
  "risk_level": "RISIKO",
  "risk_score": 3,
  "threshold": 0.0336,
  "sirs_score": 4,
  "criteria": {
    "c1_hr": true,
    "c2_rr": true,
    "c3_temp": true,
    "c4_spo2": true
  },
  "model_version": "xgb-v2",
  "timestamp": "2026-10-26T08:59:41.053442"
}
```

### `POST /predict/window` (Agregasi Data Per Jam)

Menerima deret bacaan historis (minimal 1 jam).

### `GET /health`

Memeriksa kesehatan layanan dan versi model yang sedang aktif.
