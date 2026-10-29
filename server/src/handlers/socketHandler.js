import { listBedOverview, getDeviceDetail } from "../services/dashboard.service.js";

export function registerSocketHandler(io) {
    io.on("connection", async (socket) => {
        console.log("[Socket] client connected:", socket.id);

        // Langsung kirim snapshot overview terkini begitu client terhubung
        try {
            const initialBeds = await listBedOverview();
            socket.emit("overview:data", { beds: initialBeds });
        } catch (err) {
            console.error("[Socket] Gagal kirim overview awal:", err.message);
        }

        socket.on("subscribe:overview", async () => {
            socket.join("overview");
            try {
                const beds = await listBedOverview();
                socket.emit("overview:data", { beds });
            } catch (err) {
                console.error("[Socket] error sending overview:", err.message);
            }
        });

        socket.on("unsubscribe:overview", () => {
            socket.leave("overview");
        });

        socket.on("subscribe:device", async (deviceId) => {
            if (!deviceId) return;

            // Join room dengan deviceId asli dari request
            socket.join(`device:${deviceId}`);

            if (deviceId !== "default") {
                try {
                    const detail = await getDeviceDetail(deviceId);
                    if (detail && detail.id) {
                        // Join juga room dengan numeric id jika deviceId berbeda format
                        socket.join(`device:${detail.id}`);
                        if (detail.deviceCode) {
                            socket.join(`device:${detail.deviceCode}`);
                        }
                    }
                    socket.emit("device:detail", detail);
                } catch (err) {
                    // Abaikan jika device belum terdaftar di DB
                }
            }
        });

        socket.on("unsubscribe:device", (deviceId) => {
            if (!deviceId) return;
            socket.leave(`device:${deviceId}`);
        });

        socket.on("disconnect", () => {
            console.log("[Socket] client disconnected:", socket.id);
        });
    });
}
