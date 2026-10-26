/**
 * Sepsense Socket.IO Client Helper
 * Membungkus socket.io-client dengan lazy initialization dan auto-reconnect.
 */

let socket = null;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

/**
 * Mengembalikan instance socket yang sudah terautentikasi.
 * Import getSocket() secara lazy agar tidak crash di SSR.
 */
export function getSocket() {
  if (typeof window === "undefined") return null;

  if (!socket) {
    // Dynamic require agar kompatibel dengan Next.js bundler
    const { io } = require("socket.io-client");
    const token = localStorage.getItem("sepsense_access_token");

    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
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
  }
}

/**
 * Subscribe ke update real-time untuk device tertentu.
 * Mengembalikan fungsi unsubscribe.
 */
export function subscribeToDevice(deviceId, callback) {
  const s = getSocket();
  if (!s) return () => {};

  s.emit("subscribe:device", deviceId);
  s.on("sensor:data", callback);

  return () => {
    s.emit("unsubscribe:device", deviceId);
    s.off("sensor:data", callback);
  };
}
