# Authentication API

Semua endpoint menerima dan mengembalikan JSON. Base URL default:
`http://localhost:5000`.

## Environment variables

| Variable | Wajib | Default | Keterangan |
| --- | --- | --- | --- |
| `DATABASE_URL` | ya | - | Connection string PostgreSQL. |
| `FRONTEND_URL` | tidak | `http://localhost:3000` | Origin yang diizinkan CORS. Bisa dipisah koma. |
| `JWT_ACCESS_SECRET` | ya | - | Minimal 32 karakter. Gunakan nilai acak per environment. |
| `JWT_ISSUER` | tidak | `sepsense-api` | Claim `iss` pada access token. |
| `JWT_AUDIENCE` | tidak | `sepsense-client` | Claim `aud` pada access token. |
| `ACCESS_TOKEN_TTL_SECONDS` | tidak | `900` | Umur access token (15 menit). |
| `REFRESH_TOKEN_TTL_DAYS` | tidak | `7` | Umur refresh token. |
| `COOKIE_SECURE` | tidak | `true` di production | Wajib `true` untuk HTTPS. |
| `COOKIE_SAME_SITE` | tidak | `lax` | Gunakan `none` + `COOKIE_SECURE=true` jika frontend dan API berbeda site. |
| `TRUST_PROXY` | tidak | `1` | Jumlah reverse proxy tepercaya di depan Express. |
| `AUTH_RATE_LIMIT_DISABLED` | tidak | `false` | `true` hanya untuk pengujian lokal. |

## Endpoint

### `POST /register`

Body:

```json
{
  "name": "Budi Santoso",
  "email": "budi@example.com",
  "role": "apoteker",
  "password": "rahasia123"
}
```

`role` menerima `dokter`, `perawat`, atau `apoteker` (huruf besar/kecil
sama-sama diterima). Response sukses: `201`.

```json
{
  "message": "Registrasi berhasil. Silakan masuk.",
  "user": {
    "id": 1,
    "name": "Budi Santoso",
    "email": "budi@example.com",
    "role": "APOTEKER",
    "createdAt": "2026-10-23T10:00:00.000Z"
  }
}
```

Error yang mungkin: `409` email sudah terdaftar, `422` validasi gagal.

### `POST /login`

Body:

```json
{
  "email": "budi@example.com",
  "password": "rahasia123"
}
```

Response sukses: `200`. Access token dipakai pada header
`Authorization: Bearer <accessToken>`. Refresh token dikirim sebagai cookie
`httpOnly` bernama `sepsense_refresh_token`.

```json
{
  "message": "Login berhasil.",
  "user": { "id": 1, "name": "Budi Santoso", "email": "budi@example.com", "role": "APOTEKER" },
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

Error yang mungkin: `401` email/password salah, `429` terlalu banyak
percobaan gagal.

### `POST /refresh`

Tidak perlu body. Membaca cookie refresh token, memutar token (token lama
langsung dihapus), lalu mengembalikan access token baru dan cookie refresh
baru. Response berbentuk sama dengan `/login`.

### `POST /logout`

Tidak perlu body. Menghapus refresh token dari database dan menghapus
cookie. Selalu `200` (idempotent).

### `GET /me`

Memerlukan header `Authorization: Bearer <accessToken>`.

```json
{
  "user": {
    "id": 1,
    "name": "Budi Santoso",
    "email": "budi@example.com",
    "role": "APOTEKER",
    "createdAt": "2026-10-23T10:00:00.000Z"
  }
}
```

## Catatan keamanan

- Password di-hash dengan Argon2id (19 MiB, 2 iterasi, paralelisme 1).
- Refresh token berupa nilai acak 48 byte; yang disimpan di database hanya
  SHA-256 hash-nya.
- Refresh token dirotasi setiap kali dipakai. Token lama tidak bisa dipakai ulang.
- Login selalu menjalankan verifikasi Argon2 (termasuk untuk email yang tidak
  ditemukan) untuk mengurangi kebocoran informasi lewat timing.
- Rate limit: 10 percobaan login gagal per 15 menit dan 10 registrasi per jam
  per IP.
- Cookie refresh memakai `httpOnly`, `SameSite=Lax`, dan `Secure` di production.

## Menjalankan test

```bash
npm test
```

Test integrasi memakai database pada `DATABASE_URL`, membuat satu user uji,
lalu menghapusnya kembali setelah selesai.

## Integrasi frontend

Frontend perlu:

1. Mengirim header `Content-Type: application/json`.
2. Menyimpan `accessToken` dari response login dan mengirimnya sebagai
   `Authorization: Bearer <token>` pada request terproteksi.
3. Menambahkan `credentials: "include"` pada `fetch` login/refresh/logout agar
   cookie refresh tersimpan dan terkirim.
4. Memanggil `POST /refresh` saat access token kedaluwarsa, lalu mengulang
   request yang gagal.
