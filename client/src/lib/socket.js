/**
 * Sepsense Socket.IO Client Helper
 * Membungkus socket.io-client dengan lazy initialization, auto-reconnect,
 * dan auto-resubscribe ketika koneksi pulih.
 */

let socket = null;
const activeDeviceSubscriptions = new Set();
let isOverviewSubscribed = false;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

/**
 * Mengembalikan instance socket yang sudah terautentikasi.
 * Import getSocket() secara lazy agar tidak crash di SSR.
 */
export function getSocket() {
  if (typeof window === "undefined") return null;

  if (!socket) {
    const { io } = require("socket.io-client");
    const token = localStorage.getItem("sepsense_access_token");

    socket = io(SOCKET_URL, {
      auth: (cb) => {
        const freshToken = localStorage.getItem("sepsense_access_token");
        cb({ token: freshToken || token });
      },
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 10000,
    });

    // Otomatis resubscribe ke room ketika socket terhubung kembali
    socket.on("connect", () => {
      console.log("[Socket.IO] Terhubung ke server:", socket.id);
      if (isOverviewSubscribed) {
        socket.emit("subscribe:overview");
      }
      for (const devId of activeDeviceSubscriptions) {
        socket.emit("subscribe:device", devId);
      }
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket.IO] Koneksi terputus/gagal:", err.message);
    });
  }

  return socket;
}

/**
 * Tutup koneksi socket (dipanggil saat logout).
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    activeDeviceSubscriptions.clear();
    isOverviewSubscribed = false;
  }
}

/**
 * Subscribe ke update real-time untuk seluruh dashboard overview (semua bed/device).
 * Mengembalikan fungsi unsubscribe.
 */
export function subscribeToOverview(handlers = {}) {
  const s = getSocket();
  if (!s) return () => {};

  isOverviewSubscribed = true;
  s.emit("subscribe:overview");

  const onOverviewData = (payload) => handlers.onOverviewData?.(payload);
  const onBedUpdate = (payload) => handlers.onBedUpdate?.(payload);
  const onDeviceStatus = (payload) => handlers.onDeviceStatus?.(payload);
  const onDeviceTelemetry = (payload) => handlers.onDeviceTelemetry?.(payload);

  s.on("overview:data", onOverviewData);
  s.on("overview:bed_update", onBedUpdate);
  s.on("device:status", onDeviceStatus);
  s.on("device:telemetry", onDeviceTelemetry);

  return () => {
    isOverviewSubscribed = false;
    s.emit("unsubscribe:overview");
    s.off("overview:data", onOverviewData);
    s.off("overview:bed_update", onBedUpdate);
    s.off("device:status", onDeviceStatus);
    s.off("device:telemetry", onDeviceTelemetry);
  };
}

/**
 * Subscribe ke update real-time untuk device tertentu.
 * Mengembalikan fungsi unsubscribe.
 */
export function subscribeToDevice(deviceId, callback, onPatientUpdate) {
  const s = getSocket();
  if (!s || !deviceId) return () => {};

  const devIdStr = String(deviceId);
  activeDeviceSubscriptions.add(devIdStr);
  s.emit("subscribe:device", deviceId);

  s.on("sensor:data", callback);
  s.on("device:status", callback);
  s.on("device:telemetry", callback);
  if (onPatientUpdate) {
    s.on("device:patient_update", onPatientUpdate);
  }

  return () => {
    activeDeviceSubscriptions.delete(devIdStr);
    s.emit("unsubscribe:device", deviceId);
    s.off("sensor:data", callback);
    s.off("device:status", callback);
    s.off("device:telemetry", callback);
    if (onPatientUpdate) {
      s.off("device:patient_update", onPatientUpdate);
    }
  };
}
