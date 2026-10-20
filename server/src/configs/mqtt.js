import mqtt from "mqtt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function connectMqtt() {
    const client = mqtt.connect(`mqtts://${process.env.MQTT_HOST}:${process.env.MQTT_PORT || 8883}`, {
        clientId: `server_${Math.random().toString(16).slice(2, 8)}`,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        ca: fs.readFileSync(path.join(__dirname, "../../certs/emqxsl-ca.crt")),
        rejectUnauthorized: true,
        reconnectPeriod: 3000,
        connectTimeout: 10_000,
        keepalive: 60,
    });

    client.on("connect", () => {
        console.log("[MQTT] connected");
        client.subscribe("sepsense/+/telemetry", { qos: 1 }, (err) => {
            if (err) console.error("[MQTT] subscribe error:", err.message);
            else console.log("[MQTT] subscribed to sepsense/+/telemetry");
        });
    });

    client.on("reconnect", () => console.log("[MQTT] reconnecting..."));
    client.on("close", () => console.log("[MQTT] connection closed"));
    client.on("error", (err) => console.error("[MQTT] error:", err.message));

    return client;
}