import { Server } from "socket.io";

let io; // module-level variable

export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL,
            credentials: true,
        },
    });
    return io;
}

export function getIO() {
    if (!io) throw new Error("Socket.IO belum diinisialisasi");
    return io;
}