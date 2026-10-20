import http from "http";
import express from "express";
import { connectMqtt } from "./configs/mqtt.js";
import { registerMqttHandler } from "./handlers/mqttHandler.js";
import { initSocket } from "./configs/socket.js";
import { registerSocketHandler } from "./handlers/socketHandler.js";

const app = express();
const port = process.env.PORT || 5000;

// Socket.IO harus menempel di HTTP server, bukan Express app langsung
const httpServer = http.createServer(app);
const io = initSocket(httpServer);
registerSocketHandler(io);

// MQTT — harus diinisialisasi SETELAH initSocket agar getIO() siap dipakai
const mqttClient = connectMqtt();
registerMqttHandler(mqttClient);

httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Graceful shutdown
const shutdown = () => {
  mqttClient.end(true);
  httpServer.close(() => process.exit(0));
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown); 

