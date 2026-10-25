/**
 * Frontend mengirim role dalam huruf kecil, sedangkan contract Prisma
 * menyimpan enum dalam huruf besar. Mapping ini adalah satu-satunya
 * tempat konversi tersebut dilakukan.
 */
export const ROLE_TO_DB = Object.freeze({
  dokter: "DOKTER",
  perawat: "PERAWAT",
  apoteker: "APOTEKER",
});

export const VALID_ROLES = Object.freeze(Object.keys(ROLE_TO_DB));

export const REFRESH_COOKIE_NAME = "sepsense_refresh_token";
