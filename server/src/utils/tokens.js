import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../configs/env.js";
import { AppError } from "./AppError.js";

const JWT_ALGORITHM = "HS256";

export function signAccessToken(user) {
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
    },
    env.jwtAccessSecret,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: env.accessTokenTtlSeconds,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
      subject: String(user.id),
    },
  );
}

export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret, {
      algorithms: [JWT_ALGORITHM],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });

    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0
    ) {
      throw new Error("Payload token tidak valid.");
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(
      401,
      "Sesi Anda telah berakhir. Silakan masuk kembali.",
      "INVALID_ACCESS_TOKEN",
    );
  }
}

export function generateRefreshToken() {
  // 48 byte acak => 64 karakter base64url. Cukup untuk token opaque.
  return crypto.randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getRefreshTokenExpiresAt(now = Date.now()) {
  return new Date(
    now + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  ).toISOString();
}
