import { getIO } from "../configs/socket.js";

export function registerMqttHandler(client) {
    client.on("message", async (topic, payload) => {
        try {
            const [, deviceId] = topic.split("/");
            const data = JSON.parse(payload.toString());

            console.log(`[MQTT] Data diterima dari device: ${deviceId}`);
            getIO().to(`device:${deviceId}`).emit("sensor:data", { deviceId, ...data });
        } catch (err) {
            console.error("[MQTT] gagal memproses pesan:", err.message);
        }
    });
}