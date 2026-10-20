export function registerSocketHandler(io) {
    io.on("connection", (socket) => {
        console.log("[Socket] connected:", socket.id);

        socket.on("subscribe:device", (deviceId) => {
            socket.join(`device:${deviceId}`);
        });

        socket.on("unsubscribe:device", (deviceId) => {
            socket.leave(`device:${deviceId}`);
        });

        socket.on("disconnect", () => {
            console.log("[Socket] disconnected:", socket.id);
        });
    });
}