"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Pencil,
  Check,
  X,
  Trash2,
  Plus,
  Cpu,
  Brain,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Eye,
  SlidersHorizontal,
  Calendar,
  Layers,
  Loader2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, getStoredUser } from "@/lib/api";
import { subscribeToDevice } from "@/lib/socket";
import AppShell from "@/components/AppShell";
import Navbar from "@/components/Navbar";
import SensorChart from "@/components/SensorChart";
import AlertNotificationStack from "@/components/AlertNotification";

// ──────────────────────────────────────────────
// Helpers Risk Config (0: Stabil, 1: Perlu Diamati, 2: Waspada, 3: Perlu Perhatian, 4: Mohon Diperiksa)
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
      label: "Stabil",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      text: "text-emerald-700 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-800",
      icon: ShieldCheck,
    };
  if (riskScore === 1)
    return {
      label: "Perlu Diamati",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      text: "text-blue-700 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-800",
      icon: Eye,
    };
  if (riskScore === 2)
    return {
      label: "Waspada",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-700 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-700",
      icon: AlertTriangle,
    };
  if (riskScore === 3)
    return {
      label: "Perlu Perhatian",
      bg: "bg-orange-50 dark:bg-orange-950/30",
      text: "text-orange-700 dark:text-orange-400",
      border: "border-orange-200 dark:border-orange-800",
      icon: AlertTriangle,
    };
  return {
    label: "Mohon Diperiksa",
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    icon: ShieldAlert,
  };
}

// ──────────────────────────────────────────────
// Warm-Up Progress Card — ditampilkan selama < 3 menit
// ──────────────────────────────────────────────
function WarmUpCard({ sampleCount, totalSamples = 18 }) {
  const pct = Math.round((Math.min(sampleCount, totalSamples) / totalSamples) * 100);
  const secsRemaining = Math.max(0, (totalSamples - sampleCount) * 10);
  const minsLeft = Math.floor(secsRemaining / 60);
  const secsLeft = secsRemaining % 60;

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-border/60 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-semibold font-poppins text-foreground">
            Sedang mengambil data...
          </p>
          <p className="text-xs text-muted-foreground font-inter mt-0.5">
            Klasifikasi risiko tersedia setelah 3 menit data terkumpul
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs font-mono text-muted-foreground shrink-0">
          <Clock className="w-3.5 h-3.5" />
          {minsLeft}:{String(secsLeft).padStart(2, "0")}
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5 text-[11px] font-inter text-muted-foreground">
          <span>Sampel terkumpul</span>
          <span className="font-semibold text-foreground">
            {Math.min(sampleCount, totalSamples)}/{totalSamples}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-zinc-400 dark:bg-zinc-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Risk Card
// ──────────────────────────────────────────────
function RiskCard({ riskAssessment, isWarmingUp, sampleCount }) {
  // Tampilkan warm-up state jika device masih dalam periode pengumpulan data
  if (isWarmingUp) {
    return <WarmUpCard sampleCount={sampleCount} />;
  }

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
    { key: "c1Hr", name: "Heart Rate" },
    { key: "c2Rr", name: "Respiratory Rate" },
    { key: "c3Temp", name: "Suhu Tubuh" },
    { key: "c4Spo2", name: "SpO₂" },
  ];

  return (
    <div className={cn("rounded-2xl border p-5 space-y-4", cfg.bg, cfg.border)}>
      <div className="flex items-center gap-3">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-bold font-poppins text-xl border", cfg.bg, cfg.text, cfg.border)}>
          {riskAssessment.riskScore}
        </div>
        <div>
          <p className={cn("text-[13px] font-bold font-poppins", cfg.text)}>
            <Icon className="inline w-4 h-4 mr-1 mb-0.5" />
            {cfg.label}
          </p>
          <p className="text-[11px] text-muted-foreground font-inter">
            Status:{" "}
            <span className="font-semibold text-foreground">{riskAssessment.riskLevel}</span>
          </p>
        </div>
      </div>

      {/* Criteria breakdown */}
      <div className="grid grid-cols-2 gap-2">
        {criteria.map((c) => {
          const isAbnormal = Boolean(riskAssessment[c.key]);
          return (
            <div
              key={c.key}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-inter transition-colors",
                isAbnormal
                  ? "bg-red-100/70 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
              )}
            >
              {isAbnormal ? (
                <X className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Check className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {c.name} {isAbnormal ? "abnormal" : "normal"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// AI Prediction Card
// ──────────────────────────────────────────────
function AiPredictionCard({ prediction, isWarmingUp, sampleCount }) {
  // Tampilkan warm-up state jika device masih dalam periode pengumpulan data
  if (isWarmingUp) {
    return (
      <div className="bg-card border border-border/60 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
          <Brain className="w-5 h-5 text-zinc-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold font-poppins text-foreground">
            Sedang mengambil data...
          </p>
          <p className="text-xs text-muted-foreground font-inter mt-0.5">
            Klasifikasi AI XGBoost tersedia setelah 3 menit data terkumpul
            ({Math.min(sampleCount, 18)}/18 sampel)
          </p>
        </div>
        <Loader2 className="w-4 h-4 text-zinc-400 animate-spin shrink-0" />
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="bg-card border border-border/60 rounded-2xl p-5 flex items-center gap-4">
        <Brain className="w-8 h-8 text-zinc-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold font-poppins text-foreground">
            Belum Ada Interpretasi AI
          </p>
          <p className="text-xs text-muted-foreground font-inter mt-0.5">
            Model AI akan memberikan klasifikasi setelah data sensor diterima.
          </p>
        </div>
      </div>
    );
  }

  const pct = Math.round((prediction.probability ?? 0) * 100);
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
          Klasifikasi AI XGBoost
        </p>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
          v{prediction.modelVersion || "xgb-v2"}
        </span>
      </div>

      {/* Probability bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-inter text-muted-foreground">Probabilitas Risiko Sepsis</p>
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
          ? "⚠️ Model memprediksi RISIKO SEPSIS — segera evaluasi kondisi klinis pasien."
          : "✅ Model tidak mendeteksi risiko sepsis pada sampel bacaan saat ini."}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Patient CRUD Editor (Create, Read, Update, Delete)
// ──────────────────────────────────────────────
function PatientEditor({ deviceId, patient, onPatientUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState({
    name: patient?.name || "",
    medicalRecordNo: patient?.medicalRecordNo || "",
    roomBed: patient?.roomBed || "",
    birthDate: patient?.birthDate ? patient.birthDate.split("T")[0] : "",
  });

  // Sync state ketika data pasien berubah dari socket/polling
  useEffect(() => {
    setForm({
      name: patient?.name || "",
      medicalRecordNo: patient?.medicalRecordNo || "",
      roomBed: patient?.roomBed || "",
      birthDate: patient?.birthDate ? patient.birthDate.split("T")[0] : "",
    });
  }, [patient]);

  async function handleSave(e) {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      setError("Nama pasien tidak boleh kosong.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await apiFetch(`/api/dashboard/device/${deviceId}/patient`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          medicalRecordNo: form.medicalRecordNo.trim() || undefined,
          roomBed: form.roomBed.trim() || undefined,
          birthDate: form.birthDate || undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || "Gagal menyimpan identitas pasien.");
      }

      const resData = await res.json();
      onPatientUpdated(resData.patient);
      setIsEditing(false);
      setSuccessMsg("Identitas pasien berhasil diperbarui.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.message || "Tidak dapat terhubung ke server.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Apakah Anda yakin ingin menghapus/mereset identitas pasien ini?")) {
      return;
    }

    setDeleting(true);
    setError("");
    try {
      const res = await apiFetch(`/api/dashboard/device/${deviceId}/patient`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || "Gagal menghapus data pasien.");
      }

      const resData = await res.json();
      onPatientUpdated(resData.patient);
      setIsEditing(false);
      setSuccessMsg("Identitas pasien berhasil direset.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.message || "Tidak dapat terhubung ke server.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[#4BB43A]" />
          <p className="text-sm font-semibold font-poppins text-foreground">
            Identitas Pasien
          </p>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-inter bg-muted hover:bg-muted/80 text-foreground transition-colors"
              title="Edit Identitas Pasien"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
            {patient && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-inter bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-950/50 dark:text-red-400 transition-colors"
                title="Hapus / Reset Pasien"
              >
                <Trash2 className="w-3 h-3" />
                Hapus
              </button>
            )}
          </div>
        )}
      </div>

      {successMsg && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-inter bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-200">
          {successMsg}
        </p>
      )}

      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-[11px] font-medium font-inter text-muted-foreground block mb-1">
              Nama Pasien <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Tn. Budi Santoso"
              className="w-full h-9 px-3 rounded-lg border border-border text-sm font-inter bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4BB43A]/30 focus:border-[#4BB43A]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium font-inter text-muted-foreground block mb-1">
                No. Rekam Medis (RM)
              </label>
              <input
                type="text"
                value={form.medicalRecordNo}
                onChange={(e) => setForm({ ...form, medicalRecordNo: e.target.value })}
                placeholder="RM-00123"
                className="w-full h-9 px-3 rounded-lg border border-border text-sm font-inter bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4BB43A]/30 focus:border-[#4BB43A]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium font-inter text-muted-foreground block mb-1">
                Ruangan / Bed
              </label>
              <input
                type="text"
                value={form.roomBed}
                onChange={(e) => setForm({ ...form, roomBed: e.target.value })}
                placeholder="ICU - Bed 1"
                className="w-full h-9 px-3 rounded-lg border border-border text-sm font-inter bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4BB43A]/30 focus:border-[#4BB43A]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium font-inter text-muted-foreground block mb-1">
              Tanggal Lahir (Opsional)
            </label>
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border border-border text-sm font-inter bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4BB43A]/30 focus:border-[#4BB43A]"
            />
          </div>

          {error && <p className="text-xs text-red-500 font-inter">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setError("");
              }}
              className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-inter hover:bg-muted/80 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#4BB43A] text-white text-xs font-inter hover:bg-[#3A9D2C] disabled:opacity-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? "Menyimpan…" : "Simpan Identitas"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <div>
            <p className="text-base font-semibold font-poppins text-foreground">
              {patient?.name || (
                <span className="italic text-muted-foreground font-normal">
                  Belum ada data pasien
                </span>
              )}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-inter text-muted-foreground pt-1 border-t border-border/40">
            <div>
              <span className="text-[10px] uppercase font-mono block opacity-70">No. Rekam Medis</span>
              <span className="font-medium text-foreground">{patient?.medicalRecordNo || "—"}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono block opacity-70">Ruangan</span>
              <span className="font-medium text-foreground">{patient?.roomBed || "—"}</span>
            </div>
          </div>
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

  // Live telemetry state
  const [liveReadings, setLiveReadings] = useState([]);
  const [latestWindowStats, setLatestWindowStats] = useState(null);
  const [latestBpmStatus, setLatestBpmStatus] = useState("BAIK");

  // Warm-up gate state
  // Default true karena kita tidak tahu berapa banyak sampel yang sudah ada
  // sampai payload socket pertama diterima
  const [isWarmingUp, setIsWarmingUp] = useState(true);
  const [sampleCount, setSampleCount] = useState(0);
  // Flag apakah kita sudah menerima payload socket pertama kali
  const hasReceivedFirstPayload = useRef(false);

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
    // Poll every 30 s for static detail fields
    const interval = setInterval(fetchDetail, 30_000);
    return () => clearInterval(interval);
  }, [fetchDetail, router]);

  // Real-time socket subscription
  useEffect(() => {
    if (!deviceId || deviceId === "default") return;

    const unsubscribe = subscribeToDevice(
      deviceId,
      (payload) => {
        // Cocokkan numeric ID maupun string deviceCode
        const match =
          String(payload.deviceId) === String(deviceId) ||
          String(payload.deviceCode) === String(deviceId) ||
          String(payload.bed?.deviceId) === String(deviceId) ||
          String(payload.bed?.deviceCode) === String(deviceId);

        if (!match) return;

        // Tandai bahwa payload pertama sudah diterima
        hasReceivedFirstPayload.current = true;

        // ── Update warm-up state berdasarkan flag dari backend ──
        const payloadWarmingUp = payload.warmingUp === true;
        const payloadSampleCount = payload.sampleCount ?? payload.windowStats?.sampleCount ?? 0;
        setIsWarmingUp(payloadWarmingUp);
        setSampleCount(payloadSampleCount);

        // Ambil status gerakan BPM & window stats dari payload telemetri
        const currentBpmStatus = payload.bpmStatus || "BAIK";
        setLatestBpmStatus(currentBpmStatus);

        if (payload.windowStats) {
          setLatestWindowStats(payload.windowStats);
        }

        const newReading = {
          id: Date.now(),
          recordedAt: payload.recordedAt || new Date().toISOString(),
          heartRate: payload.heartRate ?? null,
          respiratoryRate: payload.respiratoryRate ?? null,
          spo2: payload.spo2 ?? null,
          temperature: payload.temperature ?? null,
          bpmStatus: currentBpmStatus,
          assessment: payload.riskAssessment || null,
        };

        setLiveReadings((prev) => {
          const next = [...prev, newReading];
          return next.length > 60 ? next.slice(-60) : next;
        });

        // Update status koneksi, heartbeat, dan risk assessment
        // PENTING: Jika masih warm-up, JANGAN timpa riskAssessment yang sudah ada
        setDetail((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            isConnected: true,
            lastHeartbeatAt: payload.lastHeartbeatAt || new Date().toISOString(),
            sensorStatus: payload.sensorStatus ?? prev.sensorStatus,
            // Hanya update risk assessment jika warm-up sudah selesai
            latestRiskAssessment: payloadWarmingUp
              ? prev.latestRiskAssessment
              : (payload.riskAssessment ?? payload.latestRiskAssessment ?? prev.latestRiskAssessment),
            latestAiPrediction: payloadWarmingUp
              ? prev.latestAiPrediction
              : (payload.aiPrediction ?? payload.latestAiPrediction ?? prev.latestAiPrediction),
          };
        });

        // Trigger popup alert notification jika risiko tinggi (score >= 2)
        // dan warm-up sudah selesai
        if (!payloadWarmingUp) {
          const score = payload.riskAssessment?.riskScore ?? payload.latestRiskAssessment?.riskScore ?? payload.riskScore ?? 0;
          if (score >= 2) {
            setPendingAlerts((prev) => {
              if (prev.some((a) => String(a.deviceId) === String(deviceId))) return prev;
              return [
                ...prev,
                {
                  id: `alert-${deviceId}-${Date.now()}`,
                  deviceId,
                  riskScore: score,
                  label: payload.bed?.label || `Bed ${deviceId}`,
                  patientName: payload.bed?.patient?.name || `Pasien Bed ${deviceId}`,
                  roomBed: payload.bed?.patient?.roomBed || `ICU - Bed ${deviceId}`,
                },
              ];
            });
          }
        }
      },
      // Callback update data pasien real-time dari client lain
      (updatedPatient) => {
        setDetail((prev) => (prev ? { ...prev, patient: updatedPatient } : prev));
      }
    );

    return unsubscribe;
  }, [deviceId]);

  const latestReading = liveReadings[liveReadings.length - 1] ?? null;

  function handlePatientUpdated(updatedPatient) {
    setDetail((prev) => (prev ? { ...prev, patient: updatedPatient } : prev));
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
          {/* Full Patient CRUD Editor */}
          <PatientEditor
            deviceId={deviceId}
            patient={detail?.patient}
            onPatientUpdated={handlePatientUpdated}
          />

          {/* Risk Assessment Card (0–4 Scale) — menampilkan warm-up jika belum 3 menit */}
          <RiskCard
            riskAssessment={detail?.latestRiskAssessment}
            isWarmingUp={isWarmingUp}
            sampleCount={sampleCount}
          />
        </div>

        {/* AI Prediction Card — menampilkan warm-up jika belum 3 menit */}
        <AiPredictionCard
          prediction={detail?.latestAiPrediction}
          isWarmingUp={isWarmingUp}
          sampleCount={sampleCount}
        />

        {/* Signal Quality & Stability Banner (3-Minute Window / 18 Samples) */}
        {latestWindowStats && (
          <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-inter shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold font-poppins text-foreground text-sm">
                  Kestabilan Sinyal Sensor (Jendela 3 Menit)
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Berdasarkan buffer 18 sampel terbaru (metode agregasi median tahan lonjakan artefak)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-mono block">Stabilitas Sinyal</span>
                <span className={cn("font-bold text-sm", latestWindowStats.stabilityScore >= 70 ? "text-emerald-600" : "text-amber-500")}>
                  {latestWindowStats.stabilityScore}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-mono block">Variabilitas HR</span>
                <span className="font-semibold text-foreground">
                  ±{latestWindowStats.hrVariability} bpm
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-mono block">Trend HR 3m</span>
                <span className="font-semibold text-foreground">
                  {latestWindowStats.hrTrend > 0 ? `+${latestWindowStats.hrTrend}` : latestWindowStats.hrTrend} bpm
                </span>
              </div>
            </div>
          </div>
        )}

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
              bpmStatus={latestReading?.bpmStatus || latestBpmStatus}
              medianValue={latestWindowStats?.hrMedian}
              stabilityScore={latestWindowStats?.stabilityScore}
            />
            <SensorChart
              metric="respiratoryRate"
              readings={liveReadings}
              latestValue={latestReading?.respiratoryRate}
              medianValue={latestWindowStats?.respMedian}
            />
            <SensorChart
              metric="temperature"
              readings={liveReadings}
              latestValue={latestReading?.temperature}
              medianValue={latestWindowStats?.tempMedian}
            />
            <SensorChart
              metric="spo2"
              readings={liveReadings}
              latestValue={latestReading?.spo2}
              medianValue={latestWindowStats?.spo2Median}
            />
          </div>
        </div>
      </div>

      <AlertNotificationStack alerts={pendingAlerts} />
    </AppShell>
  );
}
