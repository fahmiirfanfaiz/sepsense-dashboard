"""Pelatihan Model AI Risiko Sepsis (XGBoost + Kalibrasi Isotonik + Threshold Optimization).

Fitur unggulan:
1. GroupKFold (5-fold) dipisah per Patient_ID agar 0 data leakage.
2. XGBoostClassifier dengan scale_pos_weight adaptif untuk menangani ketidakseimbangan kelas ekstrim (~2.2%).
3. Kalibrasi probabilitas Isotonic Regression untuk probabilitas klinis yang realistis.
4. Pencarian ambang batas optimal (Threshold Search) berbasis F2-Score (memprioritaskan Recall klinis) & Youden's J.
5. Benchmark perbandingan langsung dengan ambang aturan SIRS kriteria (Score >= 2).
6. Ekspor artefak: models/sepsis_xgb.joblib dan models/metrics.json.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    fbeta_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupKFold
from xgboost import XGBClassifier

from features import FEATURE_COLUMNS, VITALS, build_features, clean_vitals

MODEL_VERSION = "xgb-v2"


def load_dataset(csv_path: str) -> pd.DataFrame:
    print(f"Memuat dataset dari {csv_path} ...")
    t0 = time.time()
    cols = ["Patient_ID", "Hour", *VITALS, "SepsisLabel"]
    df = pd.read_csv(csv_path, usecols=cols, dtype={"Patient_ID": str})
    df = df.dropna(subset=["Patient_ID", "SepsisLabel"])
    df["SepsisLabel"] = df["SepsisLabel"].astype(int)
    df = df.sort_values(["Patient_ID", "Hour"]).reset_index(drop=True)
    df = clean_vitals(df)
    df = df.rename(columns={"Patient_ID": "pid"})
    print(f"  Selesai dimuat dalam {time.time() - t0:.1f}s: {len(df):,} baris, {df['pid'].nunique():,} pasien unik.")
    return df


def calculate_patient_level_auroc(pid: pd.Series, y: pd.Series, scores: np.ndarray) -> float:
    """Menghitung AUROC agregat pada tingkat pasien (skor maksimal per pasien)."""
    agg = pd.DataFrame({"pid": pid, "y": y, "score": scores}).groupby("pid").agg(
        y_max=("y", "max"), score_max=("score", "max")
    )
    return float(roc_auc_score(agg["y_max"], agg["score_max"]))


def find_optimal_threshold(y_true: np.ndarray, y_prob: np.ndarray) -> dict:
    """Mencari ambang optimal berdasarkan F2-score (prioritas recall keselamatan pasien)."""
    thresholds = np.linspace(0.01, 0.95, 200)
    best_f2 = -1.0
    best_thr = 0.5
    best_metrics = {}

    for thr in thresholds:
        preds = (y_prob >= thr).astype(int)
        rec = recall_score(y_true, preds, zero_division=0)
        prec = precision_score(y_true, preds, zero_division=0)
        f2 = fbeta_score(y_true, preds, beta=2.0, zero_division=0)

        # Youden J = Sensitivity + Specificity - 1
        tn, fp, fn, tp = confusion_matrix(y_true, preds, labels=[0, 1]).ravel()
        spec = tn / (tn + fp) if (tn + fp) > 0 else 0
        youden_j = rec + spec - 1

        if f2 > best_f2:
            best_f2 = f2
            best_thr = thr
            best_metrics = {
                "threshold": float(thr),
                "f2_score": float(f2),
                "recall": float(rec),
                "precision": float(prec),
                "specificity": float(spec),
                "youden_j": float(youden_j),
                "alert_rate": float(preds.mean()),
            }

    return best_metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Latih model AI risiko sepsis Sepsense")
    parser.add_argument("--csv", default="data/dataset.csv", help="Path ke dataset.csv")
    parser.add_argument("--out", default="models", help="Direktori penyimpanan model")
    parser.add_argument("--folds", type=int, default=5, help="Jumlah fold GroupKFold")
    parser.add_argument("--seed", type=int, default=42, help="Random seed reproduksibilitas")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = load_dataset(args.csv)
    y = df["SepsisLabel"].to_numpy()
    pos_rate = float(np.mean(y))
    neg_count = int(np.sum(y == 0))
    pos_count = int(np.sum(y == 1))
    scale_pos = neg_count / max(pos_count, 1)

    print(f"Prevalensi sepsis: {pos_rate:.2%} ({pos_count:,} positif, {neg_count:,} negatif)")
    print(f"Scale pos weight untuk XGBoost: {scale_pos:.2f}")

    print("\nMengekstraksi fitur (rolling stats, trends, cross-interactions, SIRS flags) ...")
    t0 = time.time()
    X = build_features(df, key="pid")
    print(f"  {X.shape[1]} fitur diekstraksi dalam {time.time() - t0:.1f}s.")

    print(f"\nMemulai Cross-Validation {args.folds}-Fold (GroupKFold per Patient_ID) ...")
    gkf = GroupKFold(n_splits=args.folds)
    oof_preds = np.zeros(len(df))

    fold_idx = 1
    for train_idx, val_idx in gkf.split(X, y, groups=df["pid"]):
        X_train, y_train = X.iloc[train_idx], y[train_idx]
        X_val, y_val = X.iloc[val_idx], y[val_idx]

        model = XGBClassifier(
            n_estimators=250,
            learning_rate=0.06,
            max_depth=5,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=scale_pos,
            eval_metric="logloss",
            random_state=args.seed + fold_idx,
            n_jobs=-1,
            tree_method="hist",
        )

        model.fit(X_train, y_train)
        oof_preds[val_idx] = model.predict_proba(X_val)[:, 1]

        fold_auroc = roc_auc_score(y_val, oof_preds[val_idx])
        fold_auprc = average_precision_score(y_val, oof_preds[val_idx])
        print(f"  Fold {fold_idx}: AUROC = {fold_auroc:.4f} | AUPRC = {fold_auprc:.4f}")
        fold_idx += 1

    overall_auroc = float(roc_auc_score(y, oof_preds))
    overall_auprc = float(average_precision_score(y, oof_preds))
    patient_auroc = calculate_patient_level_auroc(df["pid"], df["SepsisLabel"], oof_preds)

    print("\nMelakukan kalibrasi probabilitas (Isotonic Regression) ...")
    calibrator = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    calibrator.fit(oof_preds, y)
    calibrated_oof = calibrator.predict(oof_preds)

    print("Mencari ambang optimal berdasarkan F2-score & Youden's J ...")
    best_opt = find_optimal_threshold(y, calibrated_oof)
    optimal_thr_prob = best_opt["threshold"]

    # Cari nilai raw yang setara dengan optimal_thr_prob
    raw_sorted = np.sort(oof_preds)
    cal_sorted = calibrator.predict(raw_sorted)
    raw_idx = np.searchsorted(cal_sorted, optimal_thr_prob)
    raw_idx = min(raw_idx, len(raw_sorted) - 1)
    optimal_thr_raw = float(raw_sorted[raw_idx])

    # Evaluasi Baseline Aturan SIRS (n_crit >= 2)
    sirs_scores = X["n_crit"].to_numpy()
    sirs_preds = (sirs_scores >= 2).astype(int)
    sirs_auroc = float(roc_auc_score(y, sirs_scores))
    sirs_auprc = float(average_precision_score(y, sirs_scores))
    sirs_rec = float(recall_score(y, sirs_preds, zero_division=0))
    sirs_prec = float(precision_score(y, sirs_preds, zero_division=0))
    sirs_f2 = float(fbeta_score(y, sirs_preds, beta=2.0, zero_division=0))
    sirs_patient_auroc = calculate_patient_level_auroc(df["pid"], df["SepsisLabel"], sirs_scores)

    report = {
        "model_version": MODEL_VERSION,
        "algorithm": "XGBoost + Isotonic Calibration",
        "dataset_stats": {
            "total_rows": int(len(df)),
            "total_patients": int(df["pid"].nunique()),
            "sepsis_positive_rate": pos_rate,
        },
        "model_performance": {
            "auroc_row": overall_auroc,
            "auprc_row": overall_auprc,
            "auroc_patient": patient_auroc,
            "optimal_threshold_prob": optimal_thr_prob,
            "optimal_threshold_raw": optimal_thr_raw,
            "recall_at_optimal_threshold": best_opt["recall"],
            "precision_at_optimal_threshold": best_opt["precision"],
            "specificity_at_optimal_threshold": best_opt["specificity"],
            "f2_score": best_opt["f2_score"],
            "alert_rate": best_opt["alert_rate"],
        },
        "baseline_sirs_ge2": {
            "auroc_row": sirs_auroc,
            "auprc_row": sirs_auprc,
            "auroc_patient": sirs_patient_auroc,
            "recall": sirs_rec,
            "precision": sirs_prec,
            "f2_score": sirs_f2,
            "alert_rate": float(sirs_preds.mean()),
        },
    }

    metrics_path = out_dir / "metrics.json"
    metrics_path.write_text(json.dumps(report, indent=2))
    print(f"\nLaporan metrik tersimpan di: {metrics_path}")

    print("\n================== HASIL PERBANDINGAN PERFORMA ==================")
    print(f"Metrik                        | Model AI XGBoost     | Baseline Aturan SIRS (>=2)")
    print(f"------------------------------+----------------------+---------------------------")
    print(f"AUROC (Per Baris)             | {overall_auroc:.4f}               | {sirs_auroc:.4f}")
    print(f"AUPRC (Average Precision)     | {overall_auprc:.4f}               | {sirs_auprc:.4f}")
    print(f"AUROC (Per Pasien)            | {patient_auroc:.4f}               | {sirs_patient_auroc:.4f}")
    print(f"Recall (Sensitivitas Klinis)  | {best_opt['recall']:.2%}               | {sirs_rec:.2%}")
    print(f"Presisi (PPV)                 | {best_opt['precision']:.2%}               | {sirs_prec:.2%}")
    print(f"F2-Score (Recall Berbobot)    | {best_opt['f2_score']:.4f}               | {sirs_f2:.4f}")
    print(f"Tingkat Peringatan (Alerts)   | {best_opt['alert_rate']:.2%}               | {sirs_preds.mean():.2%}")
    print(f"=================================================================")

    print("\nMelatih model final pada seluruh dataset dengan XGBoost ...")
    final_model = XGBClassifier(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos,
        eval_metric="logloss",
        random_state=args.seed,
        n_jobs=-1,
        tree_method="hist",
    )
    final_model.fit(X, y)

    # Ekspor bobot feature importance
    importance = dict(zip(FEATURE_COLUMNS, [float(x) for x in final_model.feature_importances_]))
    top_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:10]
    print("\nTop 10 Fitur Paling Berpengaruh:")
    for name, imp in top_features:
        print(f"  - {name}: {imp:.4f}")

    artifact = {
        "model": final_model,
        "calibrator": calibrator,
        "features": FEATURE_COLUMNS,
        "threshold_raw": optimal_thr_raw,
        "threshold_prob": optimal_thr_prob,
        "model_version": MODEL_VERSION,
        "top_features": top_features,
        "sklearn_version": sklearn.__version__,
    }

    model_path = out_dir / "sepsis_xgb.joblib"
    joblib.dump(artifact, model_path)
    print(f"\nModel tersimpan di {model_path.resolve()}")

    # Juga simpan sepsis_gbm.joblib untuk kompatibilitas
    compat_path = out_dir / "sepsis_gbm.joblib"
    joblib.dump(artifact, compat_path)
    print(f"Model kompatibilitas tersimpan di {compat_path.resolve()}")


if __name__ == "__main__":
    main()
