"use client";

import { useEffect, useState } from "react";
import {
  Sun,
  Moon,
  MapPin,
  Clock,
  Wifi,
  WifiOff,
  Activity,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";

function useTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function useDarkMode() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sepsense_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("sepsense_theme", next ? "dark" : "light");
      return next;
    });
  }

  return { dark, toggle };
}

/**
 * Navbar – mode "overview" untuk main dashboard (status semua perangkat)
 * atau mode "detail" untuk halaman device (1 perangkat spesifik).
 *
 * Props:
 *  - mode: "overview" | "detail"
 *  - beds: Array<{ deviceId, label, isConnected, sensorStatus }> — untuk mode overview
 *  - device: { label, isConnected, lastHeartbeatAt, sensorStatus } — untuk mode detail
 *  - location: string — nama lokasi/bangsal
 */
export default function Navbar({ mode = "overview", beds = [], device = null, location = "RSUP Dr. Kariadi" }) {
  const time = useTime();
  const { dark, toggle } = useDarkMode();

  const connectedCount = beds.filter((b) => b.isConnected).length;
  const totalCount = beds.length;

  const timeStr = time.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = time.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-4 px-5 border-b border-border/60 bg-background/90 backdrop-blur-md shadow-sm">
      {/* Left: Title + Location */}
      <div className="flex items-center gap-3 min-w-0">
        <Activity className="w-4 h-4 text-[#4BB43A] shrink-0" />
        <h2 className="font-poppins font-semibold text-sm text-foreground truncate hidden sm:block">
          {mode === "detail" && device ? device.label : "Monitoring Sepsis"}
        </h2>
        <span className="text-border/80">|</span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate hidden md:block">{location}</span>
        </div>
      </div>

      {/* Center: Device Status */}
      <div className="flex-1 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar">
        {mode === "overview" ? (
          beds.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {beds.map((bed) => (
                <DeviceChip key={bed.deviceId} bed={bed} />
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">Tidak ada perangkat terdaftar</span>
          )
        ) : device ? (
          <DeviceDetailStatus device={device} />
        ) : null}
      </div>

      {/* Right: Clock + Dark mode toggle */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-semibold font-inter text-foreground leading-tight tabular-nums">
            {timeStr}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">{dateStr}</p>
        </div>

        <button
          onClick={toggle}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all"
          aria-label={dark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}

function DeviceChip({ bed }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium font-inter border transition-all",
        bed.isConnected
          ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400"
          : "bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-800/40 dark:border-zinc-700 dark:text-zinc-400",
      )}
      title={bed.isConnected ? "Terhubung" : "Tidak terhubung"}
    >
      {bed.isConnected ? (
        <Wifi className="w-3 h-3" />
      ) : (
        <WifiOff className="w-3 h-3" />
      )}
      <span>{bed.label}</span>
    </div>
  );
}

function DeviceDetailStatus({ device }) {
  const sinceMs = device.lastHeartbeatAt
    ? Date.now() - new Date(device.lastHeartbeatAt).getTime()
    : null;
  const sinceStr = sinceMs !== null
    ? sinceMs < 60_000
      ? `${Math.round(sinceMs / 1000)}s yang lalu`
      : `${Math.round(sinceMs / 60_000)}m yang lalu`
    : "—";

  const sensors = [
    { label: "MAX30102", ok: device.sensorStatus?.max30102 },
    { label: "MPU6050", ok: device.sensorStatus?.mpu6050 },
    { label: "MLX90614", ok: device.sensorStatus?.mlx90614 },
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap justify-center">
      {/* Connectivity */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
          device.isConnected
            ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400"
            : "bg-red-50 border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400",
        )}
      >
        {device.isConnected ? (
          <Wifi className="w-3.5 h-3.5" />
        ) : (
          <WifiOff className="w-3.5 h-3.5" />
        )}
        <span>{device.isConnected ? "Terhubung" : "Tidak Terhubung"}</span>
        <span className="text-[10px] opacity-70">{sinceStr}</span>
      </div>

      {/* Sensor Status Chips */}
      {sensors.map((s) => (
        <div
          key={s.label}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border",
            s.ok
              ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400"
              : "bg-zinc-100 border-zinc-200 text-zinc-400 dark:bg-zinc-800/50 dark:border-zinc-700",
          )}
        >
          <CircleDot className="w-2.5 h-2.5" />
          {s.label}
        </div>
      ))}
    </div>
  );
}
