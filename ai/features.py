"""Fitur untuk model deteksi risiko sepsis Sepsense.

Fitur yang diekstraksi:
1. Forward-fill vitals (HR, O2Sat, Temp, Resp)
2. Rolling stats 6-jam: mean (m6), std (sd6), min (min6), max (max6)
3. Delta/trend: lag-3 (d3) dan lag-6 (d6)
4. Cross-feature interactions: HR*Resp, Temp*HR, Shock Index (HR/Temp)
5. Kriteria SIRS / NEWS: C1 (HR>90), C2 (Resp>20), C3 (Temp>38 atau <36), C4 (SpO2<=95), n_crit (0-4)
6. Dukungan inferensi real-time dari bacaan sensor tunggal atau buffer streaming.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

VITALS = ["HR", "O2Sat", "Temp", "Resp"]

# Pemetaan nama field API/telemetri sensor IoT ke nama internal dataset
API_TO_INTERNAL = {
    "heart_rate": "HR",
    "heartRate": "HR",
    "spo2": "O2Sat",
    "spO2": "O2Sat",
    "temperature": "Temp",
    "temp": "Temp",
    "objectTemp": "Temp",
    "respiratory_rate": "Resp",
    "respiratoryRate": "Resp",
}

# Batas fisiologis wajar untuk menyaring noise/artefak sensor
PLAUSIBLE = {
    "HR": (20.0, 250.0),
    "O2Sat": (40.0, 100.0),
    "Temp": (28.0, 44.0),
    "Resp": (4.0, 70.0),
}

STAT_SUFFIXES = ["ff", "m6", "sd6", "min6", "max6", "d3", "d6"]
FEATURE_COLUMNS = (
    [f"{v}_{s}" for v in VITALS for s in STAT_SUFFIXES]
    + ["c1_hr", "c2_rr", "c3_temp", "c4_spo2", "n_crit", "shock_index", "hr_resp_prod", "temp_hr_prod"]
)


def clean_vitals(df: pd.DataFrame) -> pd.DataFrame:
    """Ubah nilai sensor di luar rentang masuk akal menjadi NaN."""
    out = df.copy()
    for col, (lo, hi) in PLAUSIBLE.items():
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce")
            out.loc[(out[col] < lo) | (out[col] > hi), col] = np.nan
    return out


def build_features(df: pd.DataFrame, key: str = "pid") -> pd.DataFrame:
    """Membangun kumpulan fitur lengkap per jam untuk training atau evaluasi window.
    
    df harus memiliki kolom: key (misal Patient_ID), Hour (atau timestamp), dan VITALS.
    """
    grp = df[key]
    ff = df[VITALS].groupby(grp).ffill()

    # Rolling window 6 jam
    roll = ff.groupby(grp).rolling(6, min_periods=1)
    mean6 = roll.mean().droplevel(0).reindex(ff.index)
    sd6 = ff.groupby(grp).rolling(6, min_periods=2).std().droplevel(0).reindex(ff.index).fillna(0.0)
    min6 = roll.min().droplevel(0).reindex(ff.index)
    max6 = roll.max().droplevel(0).reindex(ff.index)

    # Delta trend lag-3 dan lag-6
    d3 = (ff - ff.groupby(grp).shift(3)).fillna(0.0)
    d6 = (ff - ff.groupby(grp).shift(6)).fillna(0.0)

    feats = pd.DataFrame(index=df.index)
    for v in VITALS:
        feats[f"{v}_ff"] = ff[v]
        feats[f"{v}_m6"] = mean6[v]
        feats[f"{v}_sd6"] = sd6[v]
        feats[f"{v}_min6"] = min6[v]
        feats[f"{v}_max6"] = max6[v]
        feats[f"{v}_d3"] = d3[v]
        feats[f"{v}_d6"] = d6[v]

    # SIRS / NEWS Flags
    c1 = (ff["HR"] > 90).astype(int)
    c2 = (ff["Resp"] > 20).astype(int)
    c3 = ((ff["Temp"] > 38.0) | (ff["Temp"] < 36.0)).astype(int)
    c4 = (ff["O2Sat"] <= 95.0).astype(int)

    feats["c1_hr"] = c1
    feats["c2_rr"] = c2
    feats["c3_temp"] = c3
    feats["c4_spo2"] = c4
    feats["n_crit"] = c1 + c2 + c3 + c4

    # Interaksi Fisiologis
    feats["shock_index"] = ff["HR"] / (ff["Temp"].clip(lower=30.0))
    feats["hr_resp_prod"] = ff["HR"] * ff["Resp"]
    feats["temp_hr_prod"] = ff["Temp"] * ff["HR"]

    return feats[FEATURE_COLUMNS]


def extract_realtime_features(
    current: dict,
    recent_buffer: list[dict] | None = None,
) -> pd.DataFrame:
    """Mengekstraksi fitur satu baris untuk prediksi real-time dari sensor IoT.
    
    current: dict berisi pembacaan sensor terbaru {heart_rate, spo2, temperature, respiratory_rate}
    recent_buffer: list bacaan sensor historis beberapa detik/menit terakhir (opsional)
    """
    row: dict[str, float] = {}

    # Konversi input nama field ke standar internal
    vitals_now: dict[str, float | None] = {}
    for api_name, standard_name in API_TO_INTERNAL.items():
        if api_name in current and standard_name not in vitals_now:
            v = current[api_name]
            if v is not None:
                try:
                    vf = float(v)
                    lo, hi = PLAUSIBLE.get(standard_name, (0, 999))
                    vitals_now[standard_name] = vf if lo <= vf <= hi else None
                except (ValueError, TypeError):
                    vitals_now[standard_name] = None

    # Siapkan data historis jika ada buffer
    buf_vitals: dict[str, list[float]] = {v: [] for v in VITALS}
    if recent_buffer:
        for item in recent_buffer:
            for api_name, standard_name in API_TO_INTERNAL.items():
                if api_name in item:
                    val = item[api_name]
                    if val is not None:
                        try:
                            vf = float(val)
                            lo, hi = PLAUSIBLE.get(standard_name, (0, 999))
                            if lo <= vf <= hi:
                                buf_vitals[standard_name].append(vf)
                        except (ValueError, TypeError):
                            pass

    for v in VITALS:
        val = vitals_now.get(v)
        hist = buf_vitals[v]
        all_vals = hist + ([val] if val is not None else [])

        if val is not None:
            ff_val = val
        elif len(hist) > 0:
            ff_val = hist[-1]
        else:
            ff_val = np.nan

        row[f"{v}_ff"] = ff_val
        if len(all_vals) > 0:
            row[f"{v}_m6"] = float(np.mean(all_vals))
            row[f"{v}_sd6"] = float(np.std(all_vals)) if len(all_vals) > 1 else 0.0
            row[f"{v}_min6"] = float(np.min(all_vals))
            row[f"{v}_max6"] = float(np.max(all_vals))
            row[f"{v}_d3"] = float(ff_val - hist[0]) if len(hist) >= 3 else 0.0
            row[f"{v}_d6"] = float(ff_val - hist[0]) if len(hist) >= 6 else 0.0
        else:
            row[f"{v}_m6"] = np.nan
            row[f"{v}_sd6"] = 0.0
            row[f"{v}_min6"] = np.nan
            row[f"{v}_max6"] = np.nan
            row[f"{v}_d3"] = 0.0
            row[f"{v}_d6"] = 0.0

    hr = row["HR_ff"]
    resp = row["Resp_ff"]
    temp = row["Temp_ff"]
    spo2 = row["O2Sat_ff"]

    c1 = 1 if (not np.isnan(hr) and hr > 90) else 0
    c2 = 1 if (not np.isnan(resp) and resp > 20) else 0
    c3 = 1 if (not np.isnan(temp) and (temp > 38.0 or temp < 36.0)) else 0
    c4 = 1 if (not np.isnan(spo2) and spo2 <= 95.0) else 0

    row["c1_hr"] = c1
    row["c2_rr"] = c2
    row["c3_temp"] = c3
    row["c4_spo2"] = c4
    row["n_crit"] = c1 + c2 + c3 + c4

    temp_denom = max(temp, 30.0) if not np.isnan(temp) else 37.0
    row["shock_index"] = (hr / temp_denom) if not np.isnan(hr) else np.nan
    row["hr_resp_prod"] = (hr * resp) if (not np.isnan(hr) and not np.isnan(resp)) else np.nan
    row["temp_hr_prod"] = (temp * hr) if (not np.isnan(hr) and not np.isnan(temp)) else np.nan

    return pd.DataFrame([row])[FEATURE_COLUMNS]


def to_hourly(readings: list[dict]) -> pd.DataFrame:
    """Mengubah bacaan sensor berfrekuensi tinggi (detik) menjadi agregat per jam."""
    df = pd.DataFrame(readings).rename(columns=API_TO_INTERNAL)
    for v in VITALS:
        if v not in df.columns:
            df[v] = np.nan
    df["recorded_at"] = pd.to_datetime(df["recorded_at"], utc=True)
    df = clean_vitals(df)
    df["hour"] = df["recorded_at"].dt.floor("h")

    hourly = df.groupby("hour")[VITALS].median()
    if len(hourly) == 0:
        return hourly
    full_range = pd.date_range(hourly.index.min(), hourly.index.max(), freq="h")
    return hourly.reindex(full_range)
