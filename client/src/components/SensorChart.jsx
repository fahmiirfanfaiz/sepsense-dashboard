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
    refMax: 100,
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
    refMin: 36.1,
    refMax: 37.2,
    domain: [34, 42],
  },
  spo2: {
    label: "SpO₂",
    unit: "%",
    color: "#8b5cf6",
    bgColor: "rgba(139, 92, 246, 0.08)",
    refMin: 95,
    refMax: 100,
    domain: [80, 102],
  },
};

/**
 * SensorChart — visualisasi time-series data sensor vital sign menggunakan Chart.js
 *
 * Props:
 *  - metric: "heartRate" | "respiratoryRate" | "temperature" | "spo2"
 *  - readings: Array<VitalReading>  (oldest → newest)
 *  - latestValue: number | null
 */
export default function SensorChart({ metric, readings = [], latestValue }) {
  const chartRef = useRef(null);
  const cfg = CHART_CONFIG[metric];

  if (!cfg) return null;

  const labels = readings.map((r) =>
    r.recordedAt ? format(new Date(r.recordedAt), "HH:mm:ss") : "—",
  );

  const values = readings.map((r) => r[metric] ?? null);

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
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointRadius: values.length <= 1 ? 4 : 0,
        pointHoverRadius: 5,
        pointBackgroundColor: cfg.color,
        spanGaps: false,
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
        min: cfg.domain[0],
        max: cfg.domain[1],
        grid: {
          color: "rgba(156, 163, 175, 0.15)",
        },
        ticks: {
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
              ? `${Number(val).toFixed(1)} ${cfg.unit}`
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
          <p className="text-xs font-inter text-muted-foreground">{cfg.label}</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={cn("text-2xl font-bold font-poppins", statusColor)}>
              {latestValue !== null && latestValue !== undefined
                ? Number(latestValue).toFixed(1)
                : "—"}
            </span>
            <span className="text-sm text-muted-foreground font-inter">{cfg.unit}</span>
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
