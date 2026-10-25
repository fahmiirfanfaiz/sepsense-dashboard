import { ROLE_TO_DB } from "../configs/constants.js";
import { env } from "../configs/env.js";
import { db } from "../prisma/db.ts";
import { refreshTokenRepository } from "../repositories/refreshToken.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/AppError.js";
import { isUniqueViolation } from "../utils/dbErrors.js";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from "../utils/password.js";
import {
  generateRefreshToken,
  getRefreshTokenExpiresAt,
  hashRefreshToken,
  signAccessToken,
} from "../utils/tokens.js";

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function createSession(user) {
  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = getRefreshTokenExpiresAt();

  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshTokenExpiresAt,
  });

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    tokenType: "Bearer",
    expiresIn: env.accessTokenTtlSeconds,
    refreshToken,
    refreshTokenExpiresAt,
  };
}

export async function register({ name, email, role, password }) {
  const dbRole = ROLE_TO_DB[role];

  if (typeof dbRole !== "string") {
    throw new AppError(422, "Role tidak valid.", "INVALID_ROLE");
  }

  const existingUser = await userRepository.findByEmail(email);

  if (existingUser) {
    throw new AppError(
      409,
      "Email sudah terdaftar. Silakan masuk.",
      "EMAIL_ALREADY_EXISTS",
    );
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await userRepository.create({
      name,
      email,
      passwordHash,
      role: dbRole,
    });

    return { user: toPublicUser(user) };
  } catch (error) {
    // Dua request paralel bisa lolos pengecekan di atas; unique index
    // di database adalah sumber kebenaran terakhir.
    if (isUniqueViolation(error)) {
      throw new AppError(
        409,
        "Email sudah terdaftar. Silakan masuk.",
        "EMAIL_ALREADY_EXISTS",
      );
    }

    throw error;
  }
}

export async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);

  // Selalu jalankan verifikasi Argon2, termasuk saat email tidak ditemukan,
  // agar waktu respons tidak membocorkan status email.
  const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const passwordMatches = await verifyPassword(password, passwordHash);

  if (!user || !passwordMatches) {
    throw new AppError(
      401,
      "Email atau password salah.",
      "INVALID_CREDENTIALS",
    );
  }

  const session = await createSession(user);

  // Best-effort: bersihkan sesi kedaluwarsa milik user ini tanpa
  // menggagalkan login apabila pembersihan gagal.
  try {
    await refreshTokenRepository.deleteExpiredForUser(user.id);
  } catch (error) {
    console.error(
      "[AUTH] Gagal membersihkan refresh token kedaluwarsa:",
      error?.message,
    );
  }

  return session;
}

export async function refreshSession(rawRefreshToken) {
  if (!rawRefreshToken) {
    throw new AppError(
      401,
      "Sesi tidak ditemukan. Silakan masuk kembali.",
      "MISSING_REFRESH_TOKEN",
    );
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);

  return db.transaction(async (tx) => {
    // FOR UPDATE mengunci baris sampai transaksi selesai. Tanpa ini, dua
    // request refresh paralel dengan token yang sama bisa sama-sama lolos
    // dan menghasilkan dua refresh token baru.
    const storedToken = await tx.orm.public.RefreshToken
      .where({ tokenHash })
      .forUpdate()
      .first();

    if (!storedToken) {
      throw new AppError(
        401,
        "Sesi tidak valid. Silakan masuk kembali.",
        "INVALID_REFRESH_TOKEN",
      );
    }

    if (new Date(storedToken.expiresAt).getTime() <= Date.now()) {
      throw new AppError(
        401,
        "Sesi Anda telah berakhir. Silakan masuk kembali.",
        "EXPIRED_REFRESH_TOKEN",
      );
    }

    const user = await tx.orm.public.User.first({ id: storedToken.userId });

    if (!user) {
      throw new AppError(
        401,
        "Akun tidak ditemukan. Silakan masuk kembali.",
        "USER_NOT_FOUND",
      );
    }

    // Rotasi token: token lama langsung dihapus supaya tidak bisa dipakai ulang.
    await tx.orm.public.RefreshToken.where({ id: storedToken.id }).delete();

    const nextRefreshToken = generateRefreshToken();
    const nextRefreshTokenExpiresAt = getRefreshTokenExpiresAt();

    await tx.orm.public.RefreshToken.create({
      userId: user.id,
      tokenHash: hashRefreshToken(nextRefreshToken),
      expiresAt: nextRefreshTokenExpiresAt,
    });

    return {
      user: toPublicUser(user),
      accessToken: signAccessToken(user),
      tokenType: "Bearer",
      expiresIn: env.accessTokenTtlSeconds,
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt: nextRefreshTokenExpiresAt,
    };
  });
}

export async function logout(rawRefreshToken) {
  if (!rawRefreshToken) return;

  try {
    await refreshTokenRepository.deleteByHash(
      hashRefreshToken(rawRefreshToken),
    );
  } catch (error) {
    // Logout harus idempotent. Kegagalan database tidak boleh membuat
    // client terjebak dengan cookie yang tidak bisa dihapus.
    console.error("[AUTH] Gagal menghapus refresh token:", error?.message);
  }
}

export async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new AppError(
      401,
      "Akun tidak ditemukan. Silakan masuk kembali.",
      "USER_NOT_FOUND",
    );
  }

  return toPublicUser(user);
}
