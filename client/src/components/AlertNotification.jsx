"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  X,
  Bell,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RISK_LEVEL_LABELS = {
  0: "Stabil",
  1: "Perlu Diamati",
  2: "Waspada",
  3: "Perlu Perhatian",
  4: "Mohon Diperiksa",
};

/**
 * RISK_SCORE → severity
 * 0   → none (Stabil - tidak memicu toast alert)
 * 1   → watch (Perlu Diamati)
 * 2   → warning (Waspada)
 * 3   → high (Perlu Perhatian)
 * 4+  → critical (Mohon Diperiksa)
 */
function getSeverity(riskScore) {
  if (riskScore >= 4) return "critical";
  if (riskScore === 3) return "high";
  if (riskScore === 2) return "warning";
  if (riskScore === 1) return "watch";
  return "none";
}

const SEVERITY_CONFIG = {
  watch: {
    bg: "bg-blue-50 border-blue-300 dark:bg-blue-950/40 dark:border-blue-700",
    icon: Eye,
    iconColor: "text-blue-500",
    title: "🔍 Perlu Diamati",
    titleColor: "text-blue-700 dark:text-blue-400",
    bodyColor: "text-blue-800 dark:text-blue-300",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  warning: {
    bg: "bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-700",
    icon: Bell,
    iconColor: "text-amber-500",
    title: "⚠️ Waspada",
    titleColor: "text-amber-700 dark:text-amber-400",
    bodyColor: "text-amber-800 dark:text-amber-300",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  high: {
    bg: "bg-orange-50 border-orange-300 dark:bg-orange-950/40 dark:border-orange-700",
    icon: AlertTriangle,
    iconColor: "text-orange-500",
    title: "🚨 Perlu Perhatian",
    titleColor: "text-orange-700 dark:text-orange-400",
    bodyColor: "text-orange-800 dark:text-orange-300",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  },
  critical: {
    bg: "bg-red-50 border-red-400 dark:bg-red-950/40 dark:border-red-700",
    icon: ShieldAlert,
    iconColor: "text-red-500",
    title: "🔴 Mohon Diperiksa!",
    titleColor: "text-red-700 dark:text-red-400",
    bodyColor: "text-red-800 dark:text-red-300",
    badge: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  },
};

/**
 * Single alert toast item.
 */
function AlertToast({ alert, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const severity = getSeverity(alert.riskScore);
  const config = SEVERITY_CONFIG[severity];
  if (!config) return null;

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });

    // Auto-dismiss: watch 10s, warning 15s, high 20s, critical stays until closed
    if (severity !== "critical") {
      const timeout = severity === "watch" ? 10_000 : severity === "warning" ? 15_000 : 20_000;
      timerRef.current = setTimeout(() => handleDismiss(), timeout);
    }

    return () => clearTimeout(timerRef.current);
  }, []);

  function handleDismiss() {
    setVisible(false);
    setTimeout(() => onDismiss(alert.id), 300);
  }

  const Icon = config.icon;
  const statusText = RISK_LEVEL_LABELS[alert.riskScore] || "Risiko Terdeteksi";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-start gap-3 w-[360px] rounded-xl border px-4 py-3 shadow-lg transition-all duration-300",
        config.bg,
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
      )}
    >
      {/* Pulse dot for critical */}
      {severity === "critical" && (
        <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
      )}

      <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", config.iconColor)} />

      <div className="flex-1 min-w-0">
        <p className={cn("text-[13px] font-bold font-poppins", config.titleColor)}>
          {config.title}
        </p>
        <p className={cn("text-xs mt-0.5 font-inter", config.bodyColor)}>
          {alert.patientName && (
            <span className="font-semibold">{alert.patientName}</span>
          )}
          {alert.patientName && " • "}
          {alert.label} &nbsp;
          <span className={cn("inline-block px-1.5 py-0.5 rounded text-[11px] font-bold", config.badge)}>
            Skor {alert.riskScore}: {statusText}
          </span>
        </p>
        {alert.roomBed && (
          <p className={cn("text-[11px] mt-0.5 font-inter opacity-75", config.bodyColor)}>
            Ruangan: {alert.roomBed}
          </p>
        )}
      </div>

      <button
        onClick={handleDismiss}
        className="shrink-0 text-current opacity-40 hover:opacity-80 transition-opacity mt-0.5"
        aria-label="Tutup notifikasi"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * AlertNotificationStack — dirender di pojok kanan bawah layar.
 *
 * Props:
 *  - alerts: Array<{ id, riskScore, label, patientName?, roomBed? }>
 */
export default function AlertNotificationStack({ alerts = [] }) {
  const [dismissed, setDismissed] = useState(new Set());

  const visible = alerts.filter(
    (a) => getSeverity(a.riskScore) !== "none" && !dismissed.has(a.id),
  );

  function dismiss(id) {
    setDismissed((prev) => new Set([...prev, id]));
  }

  if (visible.length === 0) return null;

  return (
    <div
      aria-label="Notifikasi peringatan"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 items-end"
    >
      {visible.slice(0, 5).map((alert) => (
        <AlertToast key={alert.id} alert={alert} onDismiss={dismiss} />
      ))}
    </div>
  );
}
