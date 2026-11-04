"use client";

import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Custom plugin untuk menggambar garis batas normal (refMin & refMax)
const horizontalReferenceLinesPlugin = {
  id: "horizontalReferenceLines",
  afterDraw(chart) {
    const {
      ctx,
      chartArea,
      scales: { y },
    } = chart;
    if (!chartArea || !y) return;

    const lines = chart.options.plugins?.horizontalReferenceLines?.lines;
    if (!Array.isArray(lines)) return;

    ctx.save();
    lines.forEach(({ yValue, color, borderDash }) => {
      if (yValue === undefined || yValue === null) return;
      if (y.min !== undefined && y.max !== undefined) {
        if (yValue < y.min || yValue > y.max) return;
      }
      const yPos = y.getPixelForValue(yValue);
      if (yPos < chartArea.top || yPos > chartArea.bottom) return;

      ctx.beginPath();
      ctx.strokeStyle = color || "rgba(156, 163, 175, 0.6)";
      ctx.lineWidth = 1;
      ctx.setLineDash(borderDash || [4, 4]);
      ctx.moveTo(chartArea.left, yPos);
      ctx.lineTo(chartArea.right, yPos);
      ctx.stroke();
    });
    ctx.restore();
  },
};

// Registrasi komponen Chart.js sekali saja
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  horizontalReferenceLinesPlugin,
);

const CHART_CONFIG = {
  heartRate: {
    label: "Heart Rate",
    unit: "bpm",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.08)",
    refMin: 60,
    refMax: 90,
    domain: [30, 200],
  },
  respiratoryRate: {
    label: "Respiratory Rate",
    unit: "rpm",
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.08)",
    refMin: 12,
    refMax: 20,
    domain: [4, 40],
  },
  temperature: {
    label: "Temperature",
    unit: "°C",
    color: "#f97316",
    bgColor: "rgba(249, 115, 22, 0.08)",
    refMin: 36,
    refMax: 38,
    domain: [34, 42],
  },
  spo2: {
    label: "SpO₂ (Estimasi)",
    unit: "%",
    color: "#8b5cf6",
    bgColor: "rgba(139, 92, 246, 0.08)",
    refMin: 95.1,
    refMax: 100,
    domain: [80, 102],
  },
};

// Pemetaan status gerakan hardware ke teks bahasa Indonesia
const BPM_MOTION_STATUS_MAP = {
  TIDAK_MENEMPEL: { text: "Tidak Menempel", color: "text-amber-500", badge: "bg-amber-100 dark:bg-amber-950/40 text-amber-600 border-amber-200" },
  SINYAL_JENUH:   { text: "Sinyal Jenuh",   color: "text-rose-500",  badge: "bg-rose-100 dark:bg-rose-950/40 text-rose-600 border-rose-200" },
  GERAK:          { text: "Gerak",          color: "text-orange-500", badge: "bg-orange-100 dark:bg-orange-950/40 text-orange-600 border-orange-200" },
  MENUNGGU:       { text: "Menunggu",       color: "text-blue-500",   badge: "bg-blue-100 dark:bg-blue-950/40 text-blue-600 border-blue-200" },
  SINYAL_LEMAH:   { text: "Sinyal Lemah",   color: "text-amber-600", badge: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 border-amber-300" },
};

/**
 * SensorChart — visualisasi time-series data sensor vital sign menggunakan Chart.js
 *
 * Props:
 *  - metric: "heartRate" | "respiratoryRate" | "temperature" | "spo2"
 *  - readings: Array<VitalReading>  (oldest → newest)
 *  - latestValue: number | null
 *  - bpmStatus: string | null (Khusus Heart Rate: TIDAK_MENEMPEL, SINYAL_JENUH, GERAK, MENUNGGU, SINYAL_LEMAH, BAIK)
 *  - medianValue: number | null (Nilai median 3 menit dari buffer 18 sampel)
 *  - stabilityScore: number | null (0-100%)
 */
export default function SensorChart({
  metric,
  readings = [],
  latestValue,
  bpmStatus = "BAIK",
  medianValue = null,
  stabilityScore = null,
}) {
  const chartRef = useRef(null);
  const cfg = CHART_CONFIG[metric];

  if (!cfg) return null;

  const labels = readings.map((r, i) => {
    if (r.recordedAt) {
      try {
        return format(new Date(r.recordedAt), "HH:mm:ss");
      } catch {
        return `T-${readings.length - i}`;
      }
    }
    return `T-${readings.length - i}`;
  });

  // Ekstrak nilai metrik dengan presisi desimal lengkap untuk menangkap fluktuasi
  const values = readings.map((r) => {
    const raw = r[metric] ?? (metric === "temperature" ? (r.temp ?? r.objectTemp) : null);
    if (raw === null || raw === undefined || isNaN(Number(raw))) return null;
    return Number(Number(raw).toFixed(metric === "temperature" ? 2 : 1));
  });

  // Skala dinamis adaptif untuk visualisasi fluktuasi bidang temperatur - waktu
  const validVals = values.filter((v) => typeof v === "number" && !isNaN(v));
  let yMin = cfg.domain[0];
  let yMax = cfg.domain[1];

  if (metric === "temperature") {
    if (validVals.length > 0) {
      const minV = Math.min(...validVals);
      const maxV = Math.max(...validVals);
      const diff = maxV - minV;
      // Berikan padding adaptif di atas dan bawah agar gelombang fluktuasi terlihat jelas
      const padding = Math.max(0.3, diff * 0.3);
      yMin = Number((minV - padding).toFixed(1));
      yMax = Number((maxV + padding).toFixed(1));

      // Pastikan rentang skala minimal 1.2°C agar visualisasi fluktuasi halus dan tidak flat
      if (yMax - yMin < 1.2) {
        const center = (maxV + minV) / 2;
        yMin = Number((center - 0.7).toFixed(1));
        yMax = Number((center + 0.7).toFixed(1));
      }
    } else {
      yMin = 35.5;
      yMax = 38.5;
    }
  }

  // Periksa apakah heart rate memiliki status gerakan non-BAIK
  const upperBpmStatus = bpmStatus ? String(bpmStatus).trim().toUpperCase() : "BAIK";
  const hasMotionIssue =
    metric === "heartRate" &&
    upperBpmStatus !== "BAIK" &&
    BPM_MOTION_STATUS_MAP[upperBpmStatus];

  const motionInfo = hasMotionIssue ? BPM_MOTION_STATUS_MAP[upperBpmStatus] : null;

  const isNormal =
    latestValue !== null &&
    latestValue !== undefined &&
    latestValue >= cfg.refMin &&
    latestValue <= cfg.refMax;

  const statusColor =
    latestValue === null || latestValue === undefined
      ? "text-muted-foreground"
      : isNormal
      ? "text-emerald-500"
      : "text-red-500";

  const chartData = {
    labels: labels.length > 0 ? labels : [""],
    datasets: [
      {
        label: cfg.label,
        data: values.length > 0 ? values : [null],
        borderColor: cfg.color,
        backgroundColor: cfg.bgColor,
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: (ctx) => {
          const count = ctx.dataset.data.length;
          if (count <= 1) return 4;
          if (count <= 25) return 3;
          return 2;
        },
        pointHoverRadius: 6,
        pointBackgroundColor: cfg.color,
        spanGaps: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 300,
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 6,
          font: {
            size: 10,
            family: "var(--font-inter)",
          },
          color: "rgba(156, 163, 175, 0.8)",
        },
      },
      y: {
        min: yMin,
        max: yMax,
        grid: {
          color: "rgba(156, 163, 175, 0.15)",
        },
        ticks: {
          stepSize: metric === "temperature" ? 0.2 : undefined,
          callback: (val) => {
            if (metric === "temperature") return `${Number(val).toFixed(1)}°`;
            return val;
          },
          font: {
            size: 10,
            family: "var(--font-inter)",
          },
          color: "rgba(156, 163, 175, 0.8)",
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(24, 24, 27, 0.95)",
        titleFont: { family: "var(--font-inter)", size: 11 },
        bodyFont: { family: "var(--font-inter)", size: 12, weight: "bold" },
        padding: 8,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context) => {
            const val = context.parsed.y;
            return val !== null && val !== undefined
              ? `${Number(val).toFixed(metric === "temperature" ? 2 : 1)} ${cfg.unit}`
              : "—";
          },
        },
      },
      horizontalReferenceLines: {
        lines: [
          {
            yValue: cfg.refMin,
            color: `${cfg.color}80`,
            borderDash: [4, 4],
          },
          {
            yValue: cfg.refMax,
            color: `${cfg.color}80`,
            borderDash: [4, 4],
          },
        ],
      },
    },
  };

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-inter text-muted-foreground">{cfg.label}</p>
            {stabilityScore !== null && stabilityScore !== undefined && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border",
                  stabilityScore >= 70
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200 dark:border-emerald-800"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-200 dark:border-amber-800"
                )}
                title={`Kestabilan sinyal 3 menit: ${stabilityScore}%`}
              >
                Stabilitas: {stabilityScore}%
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 mt-0.5">
            {motionInfo ? (
              /* Jika status gerakan bukan BAIK, tampilkan status gerakan sesuai permintaan */
              <div className="flex items-center gap-2 py-0.5">
                <span className={cn("text-xl font-bold font-poppins tracking-tight", motionInfo.color)}>
                  {motionInfo.text}
                </span>
                <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold border", motionInfo.badge)}>
                  Status Sensor
                </span>
              </div>
            ) : (
              /* Jika status gerakan BAIK, tampilkan angka BPM */
              <>
                <span className={cn("text-2xl font-bold font-poppins", statusColor)}>
                  {latestValue !== null && latestValue !== undefined
                    ? Number(latestValue).toFixed(1)
                    : "—"}
                </span>
                <span className="text-sm text-muted-foreground font-inter">{cfg.unit}</span>
                {medianValue !== null && medianValue !== undefined && (
                  <span className="text-xs text-muted-foreground font-inter ml-1">
                    (Median: <strong className="text-foreground">{medianValue}</strong>)
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-muted-foreground font-inter">Normal</p>
          <p className="text-xs font-medium font-inter text-foreground">
            {cfg.refMin} – {cfg.refMax} {cfg.unit}
          </p>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-44 w-full relative">
        {readings.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-muted-foreground font-inter italic">
              Belum ada data bacaan sensor
            </p>
          </div>
        ) : (
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        )}
      </div>
    </div>
  );
}
