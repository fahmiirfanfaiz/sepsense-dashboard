"""Entrypoint FastAPI Sepsense AI Service (main.py).

Layanan klasifikasi risiko sepsis berbasis model Machine Learning (XGBoost)
menggunakan input data sensor fisiologis:
- MAX30102: Heart Rate (HR) & SpO2 (O2Sat)
- MLX90614: Body Temperature (Temp)
- MPU6050:  Respiratory Rate (Resp)

Menyediakan endpoint:
- GET  /                  Informasi API & status service
- GET  /health            Healthcheck & versi model AI yang aktif
- POST /predict/realtime  Prediksi risiko instan dari telemetri sensor IoT
- POST /predict           Prediksi berbasis jendela agregasi data sensor
- POST /predict/window    Alias untuk window prediction
"""
from __future__ import annotations

import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from features import VITALS, build_features, extract_realtime_features, to_hourly

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = os.getenv("MODEL_PATH", str(BASE_DIR / "models" / "sepsis_xgb.joblib"))
FALLBACK_MODEL_PATH = str(BASE_DIR / "models" / "sepsis_gbm.joblib")
API_KEY = os.getenv("AI_SERVICE_API_KEY")
MAX_HOURS_USED = 72

state: dict = {}


def load_model_artifact():
    path_to_load = MODEL_PATH
    if not Path(path_to_load).exists() and Path(FALLBACK_MODEL_PATH).exists():
        path_to_load = FALLBACK_MODEL_PATH

    if Path(path_to_load).exists():
        print(f"[AI Service] Memuat model dari {path_to_load} ...")
        art = joblib.load(path_to_load)
        print(f"[AI Service] Model {art.get('model_version', 'unknown')} berhasil dimuat.")
        return art
    else:
        print(f"[AI Service] ⚠️ Berkas model {path_to_load} belum ditemukan.")
        return None


@asynccontextmanager
async def lifespan(_: FastAPI):
    state["artifact"] = load_model_artifact()
    yield
    state.clear()


app = FastAPI(
    title="Sepsense AI Sepsis Prediction Service",
    description="Layanan AI untuk klasifikasi risiko sepsis real-time dari data sensor IoT.",
    version="2.0.0",
    lifespan=lifespan,
)

# Middleware CORS agar dapat diakses dari browser maupun server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def check_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if API_KEY and not (x_api_key and secrets.compare_digest(x_api_key, API_KEY)):
        raise HTTPException(status_code=401, detail="API key tidak valid")


def get_artifact():
    art = state.get("artifact")
    if not art:
        art = load_model_artifact()
        if art:
            state["artifact"] = art
            return art
        raise HTTPException(
            status_code=503,
            detail="Model AI belum tersedia. Jalankan 'python train_v2.py' untuk melatih model terlebih dahulu.",
        )
    return art


# ==========================================
# Skema Request & Response
# ==========================================

class SensorReadingItem(BaseModel):
    recorded_at: datetime | None = None
    heart_rate: float | None = None
    spo2: float | None = None
    temperature: float | None = None
    respiratory_rate: float | None = None


class RealtimePredictRequest(BaseModel):
    heart_rate: float | None = Field(default=None, description="Heart rate dari sensor MAX30102 (bpm)")
    spo2: float | None = Field(default=None, description="SpO2 dari sensor MAX30102 (%)")
    temperature: float | None = Field(default=None, description="Suhu tubuh dari sensor MLX90614 (°C)")
    respiratory_rate: float | None = Field(default=None, description="Laju pernapasan dari sensor MPU6050 (breaths/min)")
    recent_readings: list[SensorReadingItem] | None = Field(
        default=None,
        description="Buffer data bacaan beberapa detik/menit terakhir untuk menghitung tren dan rolling stats (opsional)",
    )


class CriteriaDetail(BaseModel):
    c1_hr: bool = Field(description="Heart rate abnormal (> 90 bpm)")
    c2_rr: bool = Field(description="Respiratory rate abnormal (> 20 bpm)")
    c3_temp: bool = Field(description="Suhu tubuh abnormal (> 38°C atau < 36°C)")
    c4_spo2: bool = Field(description="SpO2 abnormal (<= 95%)")


class RealtimePredictResponse(BaseModel):
    probability: float = Field(description="Probabilitas sepsis terkalibrasi klinis (0.0 - 1.0)")
    predicted_label: bool = Field(description="True jika model memprediksi risiko sepsis")
    risk_level: str = Field(description="Tingkat risiko: Stabil, Perlu Diamati, Waspada, Perlu Perhatian, Mohon Diperiksa")
    risk_score: int = Field(description="Skor risiko terintegrasi: 0 (Stabil), 1 (Perlu Diamati), 2 (Waspada), 3 (Perlu Perhatian), 4 (Mohon Diperiksa)")
    threshold: float = Field(description="Ambang batas probabilitas optimal (F2/Youden)")
    sirs_score: int = Field(description="Jumlah kriteria SIRS yang terpenuhi (0-4)")
    criteria: CriteriaDetail
    model_version: str
    timestamp: datetime


class WindowReading(BaseModel):
    recorded_at: datetime
    heart_rate: float | None = None
    respiratory_rate: float | None = None
    spo2: float | None = None
    temperature: float | None = None


class WindowPredictRequest(BaseModel):
    readings: list[WindowReading] = Field(min_length=1, max_length=50_000)


class WindowPredictResponse(BaseModel):
    probability: float
    predicted_label: bool
    risk_level: str
    risk_score: int
    threshold: float
    rule_score: int
    model_version: str
    window_start: datetime
    window_end: datetime
    hours_used: int


# ==========================================
# Endpoint Routes
# ==========================================

@app.get("/")
def root() -> dict:
    art = state.get("artifact")
    return {
        "service": "Sepsense AI Sepsis Classifier",
        "status": "online",
        "model_version": art.get("model_version") if art else "not_loaded",
        "endpoints": {
            "health": "/health",
            "predict_realtime": "/predict/realtime",
            "predict_window": "/predict/window",
            "docs": "/docs",
        },
    }


@app.get("/health")
def health() -> dict:
    art = state.get("artifact")
    model_ver = art.get("model_version") if art else "not_loaded"
    return {
        "status": "ok",
        "model_version": model_ver,
        "features_count": len(art["features"]) if art else 0,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/predict/realtime", response_model=RealtimePredictResponse, dependencies=[Depends(check_api_key)])
def predict_realtime(req: RealtimePredictRequest) -> RealtimePredictResponse:
    """Prediksi klasifikasi risiko sepsis langsung dari bacaan sensor IoT saat ini."""
    art = get_artifact()

    current_data = {
        "heart_rate": req.heart_rate,
        "spo2": req.spo2,
        "temperature": req.temperature,
        "respiratory_rate": req.respiratory_rate,
    }

    # Validasi bahwa minimal ada 1 nilai numerik yang valid
    has_valid_reading = any(v is not None and not np.isnan(v) for v in current_data.values())
    if not has_valid_reading and not req.recent_readings:
        raise HTTPException(status_code=422, detail="Setidaknya satu sensor harus menghasilkan bacaan valid.")

    buffer_dicts = [r.model_dump() for r in req.recent_readings] if req.recent_readings else None
    X_realtime = extract_realtime_features(current_data, buffer_dicts)[art["features"]]

    raw_prob = float(art["model"].predict_proba(X_realtime)[0, 1])
    calibrated_prob = float(art["calibrator"].predict([raw_prob])[0])

    thr_raw = art.get("threshold_raw", 0.5)
    thr_prob = art.get("threshold_prob", 0.35)
    predicted_label = bool(raw_prob >= thr_raw or calibrated_prob >= thr_prob)

    sirs_count = int(X_realtime["n_crit"].iloc[0])
    if sirs_count == 4 or (predicted_label and sirs_count >= 3) or calibrated_prob >= 0.70:
        risk_level = "Mohon Diperiksa"
        risk_score = 4
    elif sirs_count == 3 or (predicted_label and sirs_count >= 2) or calibrated_prob >= 0.50:
        risk_level = "Perlu Perhatian"
        risk_score = 3
    elif sirs_count == 2 or (predicted_label and sirs_count >= 1) or calibrated_prob >= 0.35:
        risk_level = "Waspada"
        risk_score = 2
    elif sirs_count == 1 or calibrated_prob >= 0.20:
        risk_level = "Perlu Diamati"
        risk_score = 1
    else:
        risk_level = "Stabil"
        risk_score = 0

    criteria = CriteriaDetail(
        c1_hr=bool(X_realtime["c1_hr"].iloc[0]),
        c2_rr=bool(X_realtime["c2_rr"].iloc[0]),
        c3_temp=bool(X_realtime["c3_temp"].iloc[0]),
        c4_spo2=bool(X_realtime["c4_spo2"].iloc[0]),
    )

    return RealtimePredictResponse(
        probability=round(calibrated_prob, 4),
        predicted_label=predicted_label,
        risk_level=risk_level,
        risk_score=risk_score,
        threshold=round(thr_prob, 4),
        sirs_score=sirs_count,
        criteria=criteria,
        model_version=art.get("model_version", "unknown"),
        timestamp=datetime.utcnow(),
    )


@app.post("/predict", response_model=WindowPredictResponse, dependencies=[Depends(check_api_key)])
@app.post("/predict/window", response_model=WindowPredictResponse, dependencies=[Depends(check_api_key)])
def predict_window(req: WindowPredictRequest) -> WindowPredictResponse:
    """Prediksi klasifikasi risiko sepsis berbasis jendela agregat per jam."""
    art = get_artifact()

    hourly = to_hourly([r.model_dump() for r in req.readings])
    hourly = hourly.tail(MAX_HOURS_USED)

    if len(hourly) == 0 or hourly[VITALS].isna().all().all():
        raise HTTPException(status_code=422, detail="Tidak ada nilai sensor vital yang valid pada data.")

    window_start, window_end = hourly.index[0], hourly.index[-1]
    frame = hourly.reset_index(drop=True)
    frame["pid"] = 0
    feats = build_features(frame, key="pid")[art["features"]]
    last = feats.iloc[[-1]]

    raw_prob = float(art["model"].predict_proba(last)[0, 1])
    calibrated_prob = float(art["calibrator"].predict([raw_prob])[0])

    thr_raw = art.get("threshold_raw", 0.5)
    thr_prob = art.get("threshold_prob", 0.35)
    predicted_label = bool(raw_prob >= thr_raw or calibrated_prob >= thr_prob)

    sirs_score = int(last["n_crit"].iloc[0])
    if sirs_score == 4 or (predicted_label and sirs_score >= 3) or calibrated_prob >= 0.70:
        risk_level = "Mohon Diperiksa"
        risk_score = 4
    elif sirs_score == 3 or (predicted_label and sirs_score >= 2) or calibrated_prob >= 0.50:
        risk_level = "Perlu Perhatian"
        risk_score = 3
    elif sirs_score == 2 or (predicted_label and sirs_score >= 1) or calibrated_prob >= 0.35:
        risk_level = "Waspada"
        risk_score = 2
    elif sirs_score == 1 or calibrated_prob >= 0.20:
        risk_level = "Perlu Diamati"
        risk_score = 1
    else:
        risk_level = "Stabil"
        risk_score = 0

    return WindowPredictResponse(
        probability=round(calibrated_prob, 4),
        predicted_label=predicted_label,
        risk_level=risk_level,
        risk_score=risk_score,
        threshold=round(thr_prob, 4),
        rule_score=sirs_score,
        model_version=art.get("model_version", "unknown"),
        window_start=window_start.to_pydatetime(),
        window_end=window_end.to_pydatetime(),
        hours_used=int(len(hourly)),
    )