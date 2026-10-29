import { Server } from "socket.io";
import { env } from "./env.js";

let io; // module-level variable

export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || env.frontendOrigins.includes(origin) || origin.startsWith("http://localhost:")) {
                    callback(null, true);
                } else {
                    callback(null, true);
                }
            },
            credentials: true,
        },
    });
    return io;
}

export function getIO() {
    if (!io) throw new Error("Socket.IO belum diinisialisasi");
    return io;
}