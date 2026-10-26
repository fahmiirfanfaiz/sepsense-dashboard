"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Pencil,
  Check,
  X,
  Cpu,
  Brain,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, getStoredUser } from "@/lib/api";
import { subscribeToDevice } from "@/lib/socket";
import AppShell from "@/components/AppShell";
import Navbar from "@/components/Navbar";
import SensorChart from "@/components/SensorChart";
import AlertNotificationStack from "@/components/AlertNotification";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function getRiskConfig(riskScore) {
  if (riskScore === null || riskScore === undefined) {
    return {
      label: "Belum Ada Data",
      bg: "bg-zinc-100 dark:bg-zinc-800",
      text: "text-zinc-400",
      border: "border-zinc-200 dark:border-zinc-700",
      icon: Activity,
    };
  }
  if (riskScore === 0)
    return {
      label: "AMAN — Tidak ada indikasi sepsis",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      text: "text-emerald-700 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-800",
      icon: ShieldCheck,
    };
  if (riskScore === 1)
    return {
      label: "WASPADA — Pantau kondisi pasien",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-700 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-700",
      icon: AlertTriangle,
    };
  return {
    label: riskScore >= 3 ? "SEPSIS — Segera tindak lanjuti!" : "RISIKO — Potensi sepsis tinggi",
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    icon: ShieldAlert,
  };
}

// ──────────────────────────────────────────────
// Risk Card
// ──────────────────────────────────────────────
function RiskCard({ riskAssessment }) {
  if (!riskAssessment) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-border/60 rounded-2xl p-5 flex items-center gap-4">
        <Activity className="w-8 h-8 text-zinc-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold font-poppins text-foreground">
            Belum Ada Penilaian Risiko
          </p>
          <p className="text-xs text-muted-foreground font-inter mt-0.5">
            Risk assessment akan muncul setelah data sensor pertama diterima.
          </p>
        </div>
      </div>
    );
  }

  const cfg = getRiskConfig(riskAssessment.riskScore);
  const Icon = cfg.icon;
  const criteria = [
    { key: "c1Hr", label: "Heart Rate abnormal" },
    { key: "c2Rr", label: "Respiratory Rate abnormal" },
    { key: "c3Temp", label: "Suhu tubuh abnormal" },
    { key: "c4Spo2", label: "SpO₂ abnormal" },
  ];

  return (
    <div className={cn("rounded-2xl border p-5 space-y-4", cfg.bg, cfg.border)}>
      <div className="flex items-center gap-3">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-bold font-poppins text-xl", cfg.bg, cfg.text, "border", cfg.border)}>
          {riskAssessment.riskScore}
        </div>
        <div>
          <p className={cn("text-[13px] font-bold font-poppins", cfg.text)}>
            <Icon className="inline w-4 h-4 mr-1 mb-0.5" />
            {cfg.label}
          </p>
          <p className="text-[11px] text-muted-foreground font-inter">
            Risk Level:{" "}
            <span className="font-semibold">{riskAssessment.riskLevel}</span>
          </p>
        </div>
      </div>

      {/* Criteria breakdown */}
      <div className="grid grid-cols-2 gap-2">
        {criteria.map((c) => (
          <div
            key={c.key}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-inter",
              riskAssessment[c.key]
                ? "bg-red-100/70 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
            )}
          >
            {riskAssessment[c.key] ? (
              <X className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Check className="w-3.5 h-3.5 shrink-0" />
            )}
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// AI Prediction Card
// ──────────────────────────────────────────────
function AiPredictionCard({ prediction }) {
  if (!prediction) {
    return (
      <div className="bg-card border border-border/60 rounded-2xl p-5 flex items-center gap-4">
        <Brain className="w-8 h-8 text-zinc-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold font-poppins text-foreground">
            Belum Ada Interpretasi AI
          </p>
          <p className="text-xs text-muted-foreground font-inter mt-0.5">
            Model AI akan memberikan interpretasi setelah window data cukup terkumpul.
          </p>
        </div>
      </div>
    );
  }

  const pct = Math.round(prediction.probability * 100);
  const isSepsis = prediction.predictedLabel;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 space-y-3",
        isSepsis
          ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
          : "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800",
      )}
    >
      <div className="flex items-center gap-2">
        <Brain className={cn("w-5 h-5", isSepsis ? "text-red-500" : "text-emerald-500")} />
        <p className="text-sm font-bold font-poppins text-foreground">
          Interpretasi AI Model
        </p>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
          v{prediction.modelVersion}
        </span>
      </div>

      {/* Probability bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-inter text-muted-foreground">Probabilitas Sepsis</p>
          <p className={cn("text-sm font-bold font-poppins", isSepsis ? "text-red-600" : "text-emerald-600")}>
            {pct}%
          </p>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              pct >= 75 ? "bg-red-500" : pct >= 50 ? "bg-orange-400" : "bg-emerald-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg px-3 py-2.5 text-xs font-semibold font-inter",
          isSepsis
            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        )}
      >
        {isSepsis
          ? "⚠️ Model memprediksi SEPSIS — segera konsultasikan dengan tim medis."
          : "✅ Model tidak mendeteksi sepsis pada window data ini."}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Patient Name Editor
// ──────────────────────────────────────────────
function PatientNameEditor({ deviceId, patient, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(patient?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Nama tidak boleh kosong.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(
        `/api/dashboard/device/${deviceId}/patient-name`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: name.trim() }),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || "Gagal menyimpan.");
      }
      onUpdated(name.trim());
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-[#4BB43A]" />
        <p className="text-sm font-semibold font-poppins text-foreground">
          Identitas Pasien
        </p>
      </div>

      {editing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              placeholder="Nama pasien"
              className="flex-1 h-9 px-3 rounded-lg border border-border text-sm font-inter bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4BB43A]/30 focus:border-[#4BB43A]"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-3 rounded-lg bg-[#4BB43A] text-white text-sm font-inter hover:bg-[#3A9D2C] disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setEditing(false); setName(patient?.name ?? ""); }}
              className="h-9 px-3 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {error && <p className="text-xs text-red-500 font-inter">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold font-poppins text-foreground">
              {patient?.name || (
                <span className="italic text-muted-foreground font-normal">
                  Belum diisi
                </span>
              )}
            </p>
            {patient?.medicalRecordNo && (
              <p className="text-xs text-muted-foreground font-inter mt-0.5">
                No. RM: {patient.medicalRecordNo}
              </p>
            )}
            {patient?.roomBed && (
              <p className="text-xs text-muted-foreground font-inter">
                Ruangan: {patient.roomBed}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              if (deviceId === "default") return;
              setEditing(true);
            }}
            disabled={deviceId === "default"}
            title={deviceId === "default" ? "Nama pasien dapat diedit saat alat terhubung" : "Edit nama pasien"}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-inter transition-colors",
              deviceId === "default"
                ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed"
                : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            )}
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Detailed Dashboard Page
// ──────────────────────────────────────────────
export default function DetailedDashboardPage() {
  const { deviceId } = useParams();
  const router = useRouter();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingAlerts, setPendingAlerts] = useState([]);

  // Live readings buffer (latest 60)
  const [liveReadings, setLiveReadings] = useState([]);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/dashboard/device/${deviceId}`);
      if (!res.ok) {
        if (res.status === 401) { router.push("/login"); return; }
        if (res.status === 404) { setError("Perangkat tidak ditemukan."); return; }
        throw new Error("Gagal memuat detail perangkat.");
      }
      const data = await res.json();
      setDetail(data);
      setLiveReadings(data.readings ?? []);

      // Trigger alert if risk >= 2
      if ((data.latestRiskAssessment?.riskScore ?? 0) >= 2) {
        setPendingAlerts([{
          id: `alert-${deviceId}-${Date.now()}`,
          riskScore: data.latestRiskAssessment.riskScore,
          label: data.label,
          patientName: data.patient?.name,
          roomBed: data.patient?.roomBed,
        }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [deviceId, router]);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) { router.push("/login"); return; }
    fetchDetail();
    // Poll every 30 s for static detail fields (session, patient info)
    const interval = setInterval(fetchDetail, 30_000);
    return () => clearInterval(interval);
  }, [fetchDetail, router]);

  // Real-time socket subscription
  useEffect(() => {
    if (!deviceId || deviceId === "default") return;

    const unsubscribe = subscribeToDevice(deviceId, (payload) => {
      if (payload.deviceId?.toString() !== deviceId?.toString()) return;

      const newReading = {
        id: Date.now(),
        recordedAt: new Date().toISOString(),
        heartRate: payload.heartRate ?? null,
        respiratoryRate: payload.respiratoryRate ?? null,
        spo2: payload.spo2 ?? null,
        temperature: payload.temperature ?? null,
        assessment: null,
      };

      setLiveReadings((prev) => {
        const next = [...prev, newReading];
        return next.length > 60 ? next.slice(-60) : next;
      });

      // Update latest risk if included in payload
      if (payload.riskAssessment) {
        setDetail((prev) =>
          prev ? { ...prev, latestRiskAssessment: payload.riskAssessment } : prev,
        );
      }
    });

    return unsubscribe;
  }, [deviceId]);

  const latestReading = liveReadings[liveReadings.length - 1] ?? null;

  function handlePatientNameUpdated(newName) {
    setDetail((prev) =>
      prev
        ? { ...prev, patient: { ...prev.patient, name: newName } }
        : prev,
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#F4F7FB] dark:bg-[#0D1117]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#4BB43A] border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground font-inter">Memuat detail perangkat…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#F4F7FB] dark:bg-[#0D1117]">
        <div className="text-center space-y-3">
          <p className="text-red-500 font-inter">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-lg bg-[#1A1A2E] text-white text-sm font-inter"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      navbar={
        <Navbar
          mode="detail"
          device={detail}
          location="Unit Perawatan Intensif"
        />
      }
    >
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-8 h-8 rounded-lg bg-card border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-sm"
            aria-label="Kembali ke dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold font-poppins text-foreground">
              {detail?.label ?? `Device ${deviceId}`}
            </h1>
            <p className="text-xs text-muted-foreground font-inter mt-0.5">
              Kode: {detail?.deviceCode ?? "—"} &nbsp;·&nbsp; Sesi ID: {detail?.session?.id ?? "Tidak ada sesi aktif"}
            </p>
          </div>
          <div className="ml-auto">
            <Cpu className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        {/* Top Info Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Patient Name Editor */}
          <PatientNameEditor
            deviceId={deviceId}
            patient={detail?.patient}
            onUpdated={handlePatientNameUpdated}
          />

          {/* Risk Assessment Card */}
          <RiskCard riskAssessment={detail?.latestRiskAssessment} />
        </div>

        {/* AI Prediction */}
        <AiPredictionCard prediction={detail?.latestAiPrediction} />

        {/* Sensor Charts — 2×2 grid */}
        <div>
          <h2 className="text-sm font-semibold font-poppins text-foreground mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#4BB43A]" />
            Bacaan Sensor Realtime
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SensorChart
              metric="heartRate"
              readings={liveReadings}
              latestValue={latestReading?.heartRate}
            />
            <SensorChart
              metric="respiratoryRate"
              readings={liveReadings}
              latestValue={latestReading?.respiratoryRate}
            />
            <SensorChart
              metric="temperature"
              readings={liveReadings}
              latestValue={latestReading?.temperature}
            />
            <SensorChart
              metric="spo2"
              readings={liveReadings}
              latestValue={latestReading?.spo2}
            />
          </div>
        </div>
      </div>

      <AlertNotificationStack alerts={pendingAlerts} />
    </AppShell>
  );
}
