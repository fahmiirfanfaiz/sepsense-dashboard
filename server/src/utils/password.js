import argon2 from "argon2";

/**
 * Parameter Argon2id mengikuti rekomendasi OWASP (minimum):
 * 19 MiB memory, 2 iterations, 1 degree of parallelism.
 */
const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
});

/**
 * Hash dummy untuk menyamakan waktu respons ketika email tidak ditemukan.
 * Tanpa ini, penyerang bisa menebak email terdaftar dari perbedaan waktu
 * antara "email tidak ada" dan "password salah".
 */
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$aFv3zhireE0O99aXr+BULQ$Y+RT0wMbyKbvOvk3mUnOrUdRwjqYPrAc3gNL7ViQxXk";

export function hashPassword(plainPassword) {
  return argon2.hash(plainPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(plainPassword, passwordHash) {
  if (!passwordHash) return false;

  try {
    return await argon2.verify(passwordHash, plainPassword);
  } catch {
    // Hash rusak / format tidak dikenal tidak boleh membuat endpoint 500.
    return false;
  }
}
