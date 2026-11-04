"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Bed,
  WifiOff,
  Wifi,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Activity,
  Eye,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, getStoredUser, bedApi } from "@/lib/api";
import { subscribeToOverview } from "@/lib/socket";
import AppShell from "@/components/AppShell";
import Navbar from "@/components/Navbar";
import AlertNotificationStack from "@/components/AlertNotification";

// ──────────────────────────────────────────────
// Risk Score helpers (0: Stabil, 1: Perlu Diamati, 2: Waspada, 3: Perlu Perhatian, 4: Mohon Diperiksa)
// ──────────────────────────────────────────────
function getRiskConfig(riskScore) {
  if (riskScore === null || riskScore === undefined) {
    return {
      label: "—",
      bg: "bg-zinc-100 dark:bg-zinc-800",
      text: "text-zinc-400 dark:text-zinc-500",
      ring: "ring-zinc-200 dark:ring-zinc-700",
      badge: "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400",
      rowBg: "",
      icon: null,
    };
  }
  if (riskScore === 0) {
    return {
      label: "Stabil",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      text: "text-emerald-600 dark:text-emerald-400",
      ring: "ring-emerald-200 dark:ring-emerald-800",
      badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400",
      rowBg: "",
      icon: ShieldCheck,
    };
  }
  if (riskScore === 1) {
    return {
      label: "Perlu Diamati",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      text: "text-blue-600 dark:text-blue-400",
      ring: "ring-blue-200 dark:ring-blue-700",
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      rowBg: "bg-blue-50/30 dark:bg-blue-950/10",
      icon: Eye,
    };
  }
  if (riskScore === 2) {
    return {
      label: "Waspada",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-600 dark:text-amber-400",
      ring: "ring-amber-200 dark:ring-amber-700",
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
      rowBg: "bg-amber-50/50 dark:bg-amber-950/10",
      icon: AlertTriangle,
    };
  }
  if (riskScore === 3) {
    return {
      label: "Perlu Perhatian",
      bg: "bg-orange-50 dark:bg-orange-950/30",
      text: "text-orange-600 dark:text-orange-400",
      ring: "ring-orange-200 dark:ring-orange-700",
      badge: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      rowBg: "bg-orange-50/60 dark:bg-orange-950/10",
      icon: AlertTriangle,
    };
  }
  // riskScore >= 4
  return {
    label: "Mohon Diperiksa",
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-600 dark:text-red-400",
    ring: "ring-red-200 dark:ring-red-800",
    badge: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400",
    rowBg: "bg-red-50/70 dark:bg-red-950/20",
    icon: ShieldAlert,
  };
}

// ──────────────────────────────────────────────
// Risk Score Badge
// Menampilkan indikator "Mengambil data..." selama fase warm-up
// ──────────────────────────────────────────────
function RiskBadge({ riskScore, warmingUp }) {
  // Selama warm-up: tampilkan spinner animasi alih-alih skor
  if (warmingUp) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center ring-2 bg-zinc-100 dark:bg-zinc-800 ring-zinc-200 dark:ring-zinc-700">
          <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-inter bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
          Mengambil data...
        </span>
      </div>
    );
  }

  const cfg = getRiskConfig(riskScore);
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-2">
      {/* Circular score display */}
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center font-bold font-poppins text-sm ring-2",
          cfg.bg,
          cfg.text,
          cfg.ring,
        )}
      >
        {riskScore ?? "—"}
      </div>
      {/* Label */}
      {Icon && (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-inter",
            cfg.badge,
          )}
        >
          <Icon className="w-3 h-3" />
          {cfg.label}
        </span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Bed Row
// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// Modal Tambah Bed Baru (CRUD: Create)
// ──────────────────────────────────────────────
function CreateBedModal({ isOpen, onClose, onCreated }) {
  const [label, setLabel] = useState("");
  const [deviceCode, setDeviceCode] = useState("");
  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await bedApi.create({
        label: label.trim() || undefined,
        deviceCode: deviceCode.trim() || undefined,
        initialPatientName: patientName.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || "Gagal membuat Bed baru.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bed className="w-5 h-5 text-[#4BB43A]" />
            <h3 className="font-poppins font-bold text-foreground text-base">Tambah Bed Baru</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-2.5 rounded-lg">{error}</div>}

          <div>
            <label className="text-xs font-medium font-inter text-muted-foreground block mb-1">
              Nama Bed (Label)
            </label>
            <input
              type="text"
              placeholder="Contoh: Bed 2 / ICU Bed 1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border text-sm font-inter bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4BB43A]/30 focus:border-[#4BB43A]"
            />
          </div>

          <div>
            <label className="text-xs font-medium font-inter text-muted-foreground block mb-1">
              Kode Perangkat
            </label>
            <input
              type="text"
              placeholder="Contoh: SEPSENSE_02"
              value={deviceCode}
              onChange={(e) => setDeviceCode(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border text-sm font-inter bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4BB43A]/30 focus:border-[#4BB43A]"
            />
          </div>

          <div>
            <label className="text-xs font-medium font-inter text-muted-foreground block mb-1">
              Nama Pasien Awal (Opsional)
            </label>
            <input
              type="text"
              placeholder="Nama pasien yang menempati bed"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border text-sm font-inter bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4BB43A]/30 focus:border-[#4BB43A]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-border text-xs font-inter font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[#4BB43A] hover:bg-[#43A234] text-white text-xs font-inter font-semibold transition-colors flex items-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Bed
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Modal Edit Data Bed (CRUD: Update)
// ──────────────────────────────────────────────
function EditBedModal({ isOpen, onClose, bed, onUpdated }) {
  const [label, setLabel] = useState("");
  const [deviceCode, setDeviceCode] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [startNewSession, setStartNewSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (bed) {
      setLabel(bed.label || "");
      setDeviceCode(bed.deviceCode || "");
      setSessionId(bed.session?.id ? String(bed.session.id) : "");
      setStartNewSession(false);
      setError("");
    }
  }, [bed]);

  if (!isOpen || !bed) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await bedApi.update(bed.deviceId, {
        label: label.trim() || undefined,
        deviceCode: deviceCode.trim() || undefined,
        sessionId: startNewSession ? undefined : (sessionId ? Number(sessionId) : undefined),
        startNewSession,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(err.message || "Gagal memperbarui data Bed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-[#4BB43A]" />
            <h3 className="font-poppins font-bold text-foreground text-base">Edit Data Bed</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-2.5 rounded-lg">{error}</div>}

          <div>
            <label className="text-xs font-medium font-inter text-muted-foreground block mb-1">
              Nama Bed (Label)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border text-sm font-inter bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4BB43A]/30 focus:border-[#4BB43A]"
              placeholder="Nama Bed"
            />
          </div>

          <div>
            <label className="text-xs font-medium font-inter text-muted-foreground block mb-1">
              Kode Perangkat
            </label>
            <input
              type="text"
              value={deviceCode}
              onChange={(e) => setDeviceCode(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border text-sm font-inter bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4BB43A]/30 focus:border-[#4BB43A]"
              placeholder="SEPSENSE_01"
            />
          </div>

          <div>
            <label className="text-xs font-medium font-inter text-muted-foreground block mb-1">
              ID Sesi Aktif (Monitoring Session ID)
            </label>
            <input
              type="number"
              value={sessionId}
              disabled={startNewSession}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border text-sm font-inter bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4BB43A]/30 focus:border-[#4BB43A] disabled:opacity-50"
              placeholder="Contoh: 1"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-inter text-foreground">
              <input
                type="checkbox"
                checked={startNewSession}
                onChange={(e) => setStartNewSession(e.target.checked)}
                className="w-4 h-4 rounded border-border text-[#4BB43A] focus:ring-[#4BB43A]"
              />
              <span>Mulai Sesi Monitoring Baru (Reset Sesi & Data Aktif)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-border text-xs font-inter font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[#4BB43A] hover:bg-[#43A234] text-white text-xs font-inter font-semibold transition-colors flex items-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Bed Row
// ──────────────────────────────────────────────
function BedRow({ bed, index, onDetail, onEdit, onDelete }) {
  const riskScore = bed.latestRiskAssessment?.riskScore ?? null;
  const warmingUp = bed.warmingUp === true;
  const cfg = warmingUp ? getRiskConfig(null) : getRiskConfig(riskScore);

  return (
    <tr
      className={cn(
        "border-b border-border/50 last:border-0 transition-colors hover:bg-muted/40 group",
        cfg.rowBg,
      )}
    >
      {/* # */}
      <td className="pl-5 pr-3 py-4 text-sm text-muted-foreground font-mono w-10">
        {index + 1}
      </td>

      {/* Bed & Patient Identity */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              bed.isConnected
                ? "bg-[#4BB43A]/10 text-[#4BB43A]"
                : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
            )}
          >
            <Bed className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold font-poppins text-foreground">
                {bed.label}
              </p>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/40">
                {bed.deviceCode}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {bed.patient?.name ? (
                <p className="text-[11px] text-muted-foreground font-inter truncate max-w-[140px]">
                  {bed.patient.name}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground font-inter italic">
                  Belum ada pasien
                </p>
              )}
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1 rounded border border-emerald-200 dark:border-emerald-800">
                Sesi #{bed.session?.id ?? "—"}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Room / Bed */}
      <td className="px-4 py-4 hidden md:table-cell">
        <span className="text-sm text-muted-foreground font-inter">
          {bed.patient?.roomBed ?? "—"}
        </span>
      </td>

      {/* Connectivity */}
      <td className="px-4 py-4 hidden sm:table-cell">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border",
            bed.isConnected
              ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
              : "bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700",
          )}
        >
          {bed.isConnected ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          {bed.isConnected ? "Aktif" : "Offline"}
        </div>
      </td>

      {/* Risk Score */}
      <td className="px-4 py-4">
        <RiskBadge riskScore={riskScore} warmingUp={warmingUp} />
      </td>

      {/* Actions (CRUD: Edit, Delete + Detail) */}
      <td className="px-4 py-4 pr-5 text-right">
        <div className="inline-flex items-center justify-end gap-1.5">
          <button
            title="Edit Data Bed (Nama, Kode, Sesi ID)"
            onClick={() => onEdit(bed)}
            className="p-1.5 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm active:scale-95"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            title="Hapus / Nonaktifkan Bed"
            onClick={() => onDelete(bed)}
            className="p-1.5 rounded-lg border border-border/60 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-600 transition-all shadow-sm active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            id={`detail-btn-${bed.deviceId}`}
            onClick={() => onDetail(bed.deviceId)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1A1A2E] hover:bg-[#1A2744] text-white text-xs font-semibold font-inter transition-all active:scale-95 shadow-sm group-hover:shadow-md"
          >
            Detail
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ──────────────────────────────────────────────
// Summary Cards
// ──────────────────────────────────────────────
function SummaryCard({ label, value, sub, colorClass }) {
  return (
    <div className="bg-card rounded-xl px-5 py-4 border border-border/60 shadow-sm flex flex-col gap-1">
      <p className="text-xs font-inter text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold font-poppins", colorClass)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground font-inter">{sub}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Dashboard Page
// ──────────────────────────────────────────────
export default function MainDashboard() {
  const router = useRouter();
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [pendingAlerts, setPendingAlerts] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingBed, setEditingBed] = useState(null);

  const fetchBeds = useCallback(async () => {
    try {
      const res = await apiFetch("/api/dashboard/beds");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Gagal memuat data bed.");
      }
      const data = await res.json();
      const bedList = data.beds ?? [];
      if (bedList.length === 0) {
        setBeds([
          {
            deviceId: "default",
            deviceCode: "N/A",
            label: "Bed 1",
            isConnected: false,
            lastHeartbeatAt: null,
            session: null,
            patient: null,
            latestRiskAssessment: null,
            warmingUp: false,
          },
        ]);
      } else {
        setBeds(bedList);
      }
      setLastRefresh(new Date());
      setError(null);

      // Trigger alerts untuk bed dengan risk >= 2 (Waspada, Perlu Perhatian, Mohon Diperiksa)
      const newAlerts = bedList
        .filter((b) => !b.warmingUp && (b.latestRiskAssessment?.riskScore ?? 0) >= 2)
        .map((b) => ({
          id: `alert-${b.deviceId}-${Date.now()}`,
          deviceId: b.deviceId,
          riskScore: b.latestRiskAssessment.riskScore,
          label: b.label,
          patientName: b.patient?.name,
          roomBed: b.patient?.roomBed,
        }));

      if (newAlerts.length > 0) {
        setPendingAlerts(newAlerts);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Initial fetch + polling fallback every 15 s
  useEffect(() => {
    fetchBeds();
    const interval = setInterval(fetchBeds, 15_000);
    return () => clearInterval(interval);
  }, [fetchBeds]);

  // Real-time WebSocket subscription via Socket.IO
  useEffect(() => {
    const unsubscribe = subscribeToOverview({
      onOverviewData: ({ beds: newBeds }) => {
        setWsConnected(true);
        if (Array.isArray(newBeds) && newBeds.length > 0) {
          setBeds(newBeds);
          setLoading(false);
          setError(null);
        }
      },
      onBedUpdate: (updatedBed) => {
        setWsConnected(true);
        if (!updatedBed?.deviceId) return;
        setBeds((prev) => {
          const list = prev.filter((b) => b.deviceId !== "default");
          const idx = list.findIndex((b) => String(b.deviceId) === String(updatedBed.deviceId));
          if (idx >= 0) {
            const next = [...list];
            next[idx] = { ...next[idx], ...updatedBed, isConnected: true };
            return next;
          }
          return [...list, { ...updatedBed, isConnected: true }];
        });
      },
      onDeviceStatus: (statusPayload) => {
        setWsConnected(true);
        if (!statusPayload?.deviceId) return;
        setBeds((prev) => {
          const list = prev.filter((b) => b.deviceId !== "default");
          const idx = list.findIndex((b) =>
            String(b.deviceId) === String(statusPayload.deviceId) ||
            (statusPayload.deviceCode && String(b.deviceCode) === String(statusPayload.deviceCode))
          );
          if (idx >= 0) {
            const next = [...list];
            next[idx] = { ...next[idx], ...statusPayload, isConnected: true };
            return next;
          }
          return [...list, { ...statusPayload, isConnected: true }];
        });
      },
      onDeviceTelemetry: (payload) => {
        setWsConnected(true);
        if (!payload?.deviceId) return;
        const devId = payload.deviceId;
        const payloadWarmingUp = payload.warmingUp === true;

        // Hanya update risk assessment jika warm-up sudah selesai
        const updatedRisk = payloadWarmingUp
          ? undefined // undefined = pertahankan nilai lama di setBeds
          : (payload.latestRiskAssessment || payload.riskAssessment || (payload.riskScore != null ? {
              riskScore: payload.riskScore,
              c1Hr: Boolean(payload.c1_hr),
              c2Rr: Boolean(payload.c2_rr),
              c3Temp: Boolean(payload.c3_temp),
              c4Spo2: false,
            } : null));

        setBeds((prev) => {
          const list = prev.filter((b) => b.deviceId !== "default");
          const idx = list.findIndex((b) =>
            String(b.deviceId) === String(devId) ||
            (payload.deviceCode && String(b.deviceCode) === String(payload.deviceCode))
          );
          if (idx >= 0) {
            const next = [...list];
            next[idx] = {
              ...next[idx],
              isConnected: true,
              lastHeartbeatAt: payload.lastHeartbeatAt || new Date().toISOString(),
              // Jika warm-up, pertahankan latestRiskAssessment lama; jika sudah selesai, update
              latestRiskAssessment: updatedRisk !== undefined
                ? (updatedRisk ?? next[idx].latestRiskAssessment)
                : next[idx].latestRiskAssessment,
              sensorStatus: payload.sensorStatus ?? next[idx].sensorStatus,
              patient: payload.bed?.patient?.name ? payload.bed.patient : next[idx].patient,
              // Simpan flag warm-up agar BedRow tahu harus tampilkan spinner
              warmingUp: payloadWarmingUp,
              sampleCount: payload.sampleCount ?? payload.windowStats?.sampleCount,
            };
            return next;
          }

          const newBed = payload.bed || {
            deviceId: devId,
            deviceCode: payload.deviceCode || `SEPSENSE_0${devId}`,
            label: payload.label || `Bed ${devId}`,
            isConnected: true,
            lastHeartbeatAt: payload.lastHeartbeatAt || new Date().toISOString(),
            sensorStatus: {
              max30102: Boolean(payload.heartRate != null || payload.spo2 != null),
              mpu6050: Boolean(payload.respiratoryRate != null),
              mlx90614: Boolean(payload.temperature != null),
            },
            patient: payload.patient || { name: `Pasien Bed ${devId}`, roomBed: `ICU - Bed ${devId}` },
            latestRiskAssessment: payloadWarmingUp ? null : updatedRisk,
            warmingUp: payloadWarmingUp,
            sampleCount: payload.sampleCount ?? payload.windowStats?.sampleCount,
          };
          return [...list, newBed];
        });

        // Trigger alert hanya jika warm-up sudah selesai dan risiko >= 2
        if (!payloadWarmingUp) {
          const score = payload.latestRiskAssessment?.riskScore ?? payload.riskScore ?? 0;
          if (score >= 2) {
            setPendingAlerts((prev) => {
              if (prev.some((a) => String(a.deviceId) === String(devId))) return prev;
              return [
                ...prev,
                {
                  id: `alert-${devId}-${Date.now()}`,
                  deviceId: devId,
                  riskScore: score,
                  label: payload.bed?.label || `Bed ${devId}`,
                  patientName: payload.bed?.patient?.name || `Pasien Bed ${devId}`,
                  roomBed: payload.bed?.patient?.roomBed || `ICU - Bed ${devId}`,
                },
              ];
            });
          }
        }
      },
    });

    return unsubscribe;
  }, []);

  // Redirect to login if no user
  useEffect(() => {
    const user = getStoredUser();
    if (!user) router.push("/login");
  }, [router]);

  const totalBeds = beds.length;
  const warmingUpCount = beds.filter((b) => b.warmingUp === true && b.isConnected).length;
  // Kondisi Stabil: Skor 0 - 1
  const stabilCount = beds.filter(
    (b) => !b.warmingUp && (b.latestRiskAssessment?.riskScore ?? 0) <= 1,
  ).length;
  // Waspada / Periksa: Skor >= 2
  const waspadaPeriksaCount = beds.filter(
    (b) => !b.warmingUp && (b.latestRiskAssessment?.riskScore ?? 0) >= 2,
  ).length;

  async function handleDeleteBed(bed) {
    if (!window.confirm(`Apakah Anda yakin ingin menonaktifkan ${bed.label}?`)) return;
    try {
      await bedApi.delete(bed.deviceId);
      await fetchBeds();
    } catch (err) {
      alert(err.message || "Gagal menghapus Bed.");
    }
  }

  return (
    <AppShell
      navbar={
        <Navbar
          mode="overview"
          beds={beds}
          location="Ruang Rawat Inap"
        />
      }
    >
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-poppins text-foreground">
              Main Dashboard
            </h1>
            <p className="text-sm text-muted-foreground font-inter mt-0.5">
              Monitoring realtime seluruh pasien yang terhubung perangkat Sepsense
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-inter border transition-colors",
                wsConnected
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400"
                  : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  wsConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                )}
              />
              <span className="font-medium">
                {wsConnected ? "WebSocket Live" : "Menghubungkan WS..."}
              </span>
            </div>
            <button
              onClick={fetchBeds}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border/60 text-sm font-inter text-muted-foreground hover:text-foreground hover:border-border transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards — 3 Cards: Total Bed, Kondisi Stabil (Skor 0-1), Waspada / Periksa (Skor >= 2) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            label="Total Bed"
            value={totalBeds}
            sub="Bed terdaftar"
            colorClass="text-foreground"
          />
          <SummaryCard
            label="Kondisi Stabil"
            value={stabilCount}
            sub="Skor 0 - 1 (Stabil & Diamati)"
            colorClass="text-[#4BB43A] dark:text-[#4BB43A]"
          />
          <SummaryCard
            label="Waspada / Periksa"
            value={waspadaPeriksaCount}
            sub="Skor ≥ 2 (Risiko Sepsis)"
            colorClass="text-red-600 dark:text-red-400"
          />
        </div>

        {/* Warm-up notice banner — hanya tampil jika ada device dalam fase warm-up */}
        {warmingUpCount > 0 && (
          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 border border-border/60 rounded-xl px-4 py-3 text-sm font-inter text-muted-foreground">
            <Loader2 className="w-4 h-4 text-zinc-400 animate-spin shrink-0" />
            <span>
              <span className="font-semibold text-foreground">{warmingUpCount} perangkat</span>
              {" "}sedang dalam fase pengumpulan data awal (3 menit). Risk score akan muncul setelah data terkumpul.
            </span>
          </div>
        )}

        {/* Beds Table */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#4BB43A]" />
              <h2 className="text-sm font-semibold font-poppins text-foreground">
                Status Pasien per Bed
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4BB43A] hover:bg-[#43A234] text-white text-xs font-semibold font-inter transition-all shadow-sm active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Bed
              </button>
              {lastRefresh && (
                <p suppressHydrationWarning className="text-[11px] text-muted-foreground font-inter hidden sm:block">
                  Diperbarui:{" "}
                  {lastRefresh.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Loading / Error states */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#4BB43A] border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground font-inter">
                  Memuat data bed…
                </p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-sm text-red-500 font-inter">{error}</p>
              <button
                onClick={fetchBeds}
                className="px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-inter hover:bg-red-100 transition-colors"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/40">
                    <th className="pl-5 pr-3 py-3 text-[11px] font-semibold font-inter text-muted-foreground uppercase tracking-wider w-10">
                      #
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold font-inter text-muted-foreground uppercase tracking-wider">
                      Bed / Pasien
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold font-inter text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                      Ruangan
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold font-inter text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                      Koneksi
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold font-inter text-muted-foreground uppercase tracking-wider">
                      Risk Score
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold font-inter text-muted-foreground uppercase tracking-wider text-right pr-5">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {beds.map((bed, i) => (
                    <BedRow
                      key={bed.deviceId}
                      bed={bed}
                      index={i}
                      onDetail={(deviceId) =>
                        router.push(`/dashboard/${deviceId}`)
                      }
                      onEdit={(b) => setEditingBed(b)}
                      onDelete={handleDeleteBed}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals CRUD Bed */}
      <CreateBedModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={fetchBeds}
      />
      <EditBedModal
        isOpen={Boolean(editingBed)}
        onClose={() => setEditingBed(null)}
        bed={editingBed}
        onUpdated={fetchBeds}
      />

      {/* Alert Notification Stack */}
      <AlertNotificationStack alerts={pendingAlerts} />
    </AppShell>
  );
}
