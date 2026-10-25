import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../configs/env.js";

const sharedOptions = Object.freeze({
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => env.disableRateLimit || env.nodeEnv === "test",
});

export const registerLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: {
    message:
      "Terlalu banyak percobaan registrasi dari alamat ini. Silakan coba lagi dalam 1 jam.",
    code: "RATE_LIMITED",
  },
});

/**
 * Composite rate limiter untuk login:
 * Menggabungkan IP dan email pengguna (IP:email).
 * Mencegah satu user salah password menyebabkan lockout bagi seluruh
 * tenaga medis lain di rumah sakit yang berbagi satu public IP NAT yang sama.
 */
export const loginLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req, res);
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    return email ? `${ip}:${email}` : ip;
  },
  message: {
    message:
      "Terlalu banyak percobaan masuk yang gagal untuk akun ini. Silakan coba lagi dalam 15 menit.",
    code: "RATE_LIMITED",
  },
});

export const refreshLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: {
    message: "Terlalu banyak permintaan refresh sesi. Silakan coba lagi nanti.",
    code: "RATE_LIMITED",
  },
});
