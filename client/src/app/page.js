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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, getStoredUser } from "@/lib/api";
import AppShell from "@/components/AppShell";
import Navbar from "@/components/Navbar";
import AlertNotificationStack from "@/components/AlertNotification";

// ──────────────────────────────────────────────
// Risk Score helpers
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
      label: "AMAN",
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
      label: "WASPADA",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-600 dark:text-amber-400",
      ring: "ring-amber-200 dark:ring-amber-700",
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
      rowBg: "bg-amber-50/50 dark:bg-amber-950/10",
      icon: AlertTriangle,
    };
  }
  // ≥ 2
  return {
    label: riskScore >= 3 ? "SEPSIS" : "RISIKO",
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-600 dark:text-red-400",
    ring: "ring-red-200 dark:ring-red-800",
    badge: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400",
    rowBg: "bg-red-50/60 dark:bg-red-950/10",
    icon: ShieldAlert,
  };
}

// ──────────────────────────────────────────────
// Risk Score Badge
// ──────────────────────────────────────────────
function RiskBadge({ riskScore }) {
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
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold font-inter",
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
function BedRow({ bed, index, onDetail }) {
  const riskScore = bed.latestRiskAssessment?.riskScore ?? null;
  const cfg = getRiskConfig(riskScore);

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

      {/* Bed label */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              bed.isConnected
                ? "bg-[#4BB43A]/10 text-[#4BB43A]"
                : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
            )}
          >
            <Bed className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold font-poppins text-foreground">
              {bed.label}
            </p>
            {bed.patient?.name && (
              <p className="text-[11px] text-muted-foreground font-inter truncate max-w-[160px]">
                {bed.patient.name}
              </p>
            )}
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
        <RiskBadge riskScore={riskScore} />
      </td>

      {/* Detail button */}
      <td className="px-4 py-4 pr-5 text-right">
        <button
          id={`detail-btn-${bed.deviceId}`}
          onClick={() => onDetail(bed.deviceId)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1A1A2E] hover:bg-[#1A2744] text-white text-xs font-semibold font-inter transition-all active:scale-95 shadow-sm group-hover:shadow-md"
        >
          Detail
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
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
          },
        ]);
      } else {
        setBeds(bedList);
      }
      setLastRefresh(new Date());
      setError(null);

      // Trigger alerts for beds with risk >= 2
      const newAlerts = bedList
        .filter((b) => (b.latestRiskAssessment?.riskScore ?? 0) >= 2)
        .map((b) => ({
          id: `alert-${b.deviceId}-${Date.now()}`,
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

  // Initial fetch + polling every 10 s
  useEffect(() => {
    fetchBeds();
    const interval = setInterval(fetchBeds, 10_000);
    return () => clearInterval(interval);
  }, [fetchBeds]);

  // Redirect to login if no user
  useEffect(() => {
    const user = getStoredUser();
    if (!user) router.push("/login");
  }, [router]);

  const connectedCount = beds.filter((b) => b.isConnected).length;
  const riskCount = beds.filter(
    (b) => (b.latestRiskAssessment?.riskScore ?? 0) >= 2,
  ).length;
  const waspCount = beds.filter(
    (b) => b.latestRiskAssessment?.riskScore === 1,
  ).length;

  return (
    <AppShell
      navbar={
        <Navbar
          mode="overview"
          beds={beds}
          location="Unit Perawatan Intensif"
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
              Monitoring realtime seluruh pasien yang terhubung perangkat SepSense
            </p>
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Bed"
            value={beds.length}
            sub="Bed terdaftar"
            colorClass="text-foreground"
          />
          <SummaryCard
            label="Terhubung"
            value={connectedCount}
            sub={`dari ${beds.length} bed`}
            colorClass="text-emerald-600 dark:text-emerald-400"
          />
          <SummaryCard
            label="Waspada"
            value={waspCount}
            sub="Risk Score = 1"
            colorClass="text-amber-500"
          />
          <SummaryCard
            label="Berisiko Sepsis"
            value={riskCount}
            sub="Risk Score ≥ 2"
            colorClass="text-red-600 dark:text-red-400"
          />
        </div>

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
            {lastRefresh && (
              <p className="text-[11px] text-muted-foreground font-inter">
                Diperbarui:{" "}
                {lastRefresh.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            )}
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
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Alert Notification Stack */}
      <AlertNotificationStack alerts={pendingAlerts} />
    </AppShell>
  );
}
