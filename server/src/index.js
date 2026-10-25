import "dotenv/config";
import http from "node:http";
import { createApp } from "./app.js";
import { connectMqtt } from "./configs/mqtt.js";
import { env } from "./configs/env.js";
import { initSocket } from "./configs/socket.js";
import { registerMqttHandler } from "./handlers/mqttHandler.js";
import { registerSocketHandler } from "./handlers/socketHandler.js";
import { db } from "./prisma/db.ts";

const app = createApp();

// Socket.IO harus menempel di HTTP server, bukan Express app langsung
const httpServer = http.createServer(app);
const io = initSocket(httpServer);
registerSocketHandler(io);

// MQTT — harus diinisialisasi SETELAH initSocket agar getIO() siap dipakai
const mqttClient = connectMqtt();
registerMqttHandler(mqttClient);

httpServer.listen(env.port, () => {
  console.log(`Server is running on http://localhost:${env.port}`);
});

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Server] ${signal} diterima. Menutup koneksi...`);

  // Jangan biarkan proses menggantung jika ada koneksi yang tidak kunjung tutup.
  const forceExitTimer = setTimeout(() => {
    console.error("[Server] Timeout saat shutdown. Memaksa keluar.");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  try {
    mqttClient.end(true);
    io.close();

    await db.close();
  } catch (error) {
    console.error("[Server] Gagal menutup koneksi:", error?.message);
  } finally {
    clearTimeout(forceExitTimer);
    process.exit(0);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[Process] Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Process] Uncaught exception:", error);
  void shutdown("uncaughtException");
});
