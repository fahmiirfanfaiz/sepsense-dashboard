/**
 * Prisma 8 membungkus error driver dalam envelope terstruktur. Kode
 * PostgreSQL untuk unique violation adalah 23505. Pemeriksaan teks dipakai
 * sebagai fallback agar tetap aman ketika envelope berubah antar versi.
 */
export function isUniqueViolation(error) {
  const text = [
    error?.code,
    error?.message,
    error?.cause?.code,
    error?.cause?.message,
    error?.cause?.detail,
  ]
    .filter(Boolean)
    .join(" ");

  return text.includes("23505") || /duplicate key|unique constraint/i.test(text);
}
