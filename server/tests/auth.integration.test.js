// Integration test untuk alur autentikasi.
// Test ini memakai database dari DATABASE_URL, sehingga user uji selalu
// dihapus kembali di blok `after`.
process.env.NODE_ENV = "test";
process.env.AUTH_RATE_LIMIT_DISABLED = "true";

import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";

const { createApp } = await import("../src/app.js");
const { db } = await import("../src/prisma/db.ts");

const REFRESH_COOKIE_NAME = "sepsense_refresh_token";
const TEST_PASSWORD = "TestPassword123";
const TEST_EMAIL = `auth.test.${Date.now()}.${Math.random()
  .toString(16)
  .slice(2)}@example.com`;

let server;
let baseUrl;

function readCookie(response, name) {
  const cookies =
    response.headers.getSetCookie?.() ??
    [response.headers.get("set-cookie")].filter(Boolean);

  for (const cookie of cookies) {
    const [pair] = cookie.split(";");
    const separatorIndex = pair.indexOf("=");

    if (separatorIndex === -1) continue;

    if (pair.slice(0, separatorIndex) === name) {
      return pair.slice(separatorIndex + 1);
    }
  }

  return null;
}

async function request(path, { method = "GET", body, token, cookie } = {}) {
  const headers = {};

  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = `${REFRESH_COOKIE_NAME}=${cookie}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  return { response, data };
}

before(async () => {
  const app = createApp();
  server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  try {
    await db.orm.public.User.where({ email: TEST_EMAIL }).delete();
  } catch (error) {
    console.error("Gagal membersihkan user uji:", error?.message);
  }

  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });

  await db.close();
});

test("registrasi berhasil dan mengembalikan data user tanpa hash password", async () => {
  const { response, data } = await request("/register", {
    method: "POST",
    body: {
      name: "Test User",
      email: TEST_EMAIL,
      role: "apoteker",
      password: TEST_PASSWORD,
    },
  });

  assert.equal(response.status, 201);
  assert.equal(data.user.email, TEST_EMAIL);
  assert.equal(data.user.name, "Test User");
  assert.equal(data.user.role, "APOTEKER");
  assert.equal("passwordHash" in data.user, false);
});

test("registrasi dengan email yang sama ditolak 409", async () => {
  const { response, data } = await request("/register", {
    method: "POST",
    body: {
      name: "Test User",
      email: TEST_EMAIL,
      role: "dokter",
      password: TEST_PASSWORD,
    },
  });

  assert.equal(response.status, 409);
  assert.match(data.message, /sudah terdaftar/i);
});

test("registrasi dengan role tidak dikenal ditolak 422", async () => {
  const { response, data } = await request("/register", {
    method: "POST",
    body: {
      name: "Test User",
      email: `invalid.${TEST_EMAIL}`,
      role: "admin",
      password: TEST_PASSWORD,
    },
  });

  assert.equal(response.status, 422);
  assert.match(data.message, /role/i);
});

test("login dengan password salah ditolak 401", async () => {
  const { response, data } = await request("/login", {
    method: "POST",
    body: { email: TEST_EMAIL, password: "PasswordSalah123" },
  });

  assert.equal(response.status, 401);
  assert.match(data.message, /email atau password salah/i);
});

let accessToken;
let refreshCookie;
let rotatedAwayToken;

test("login berhasil mengembalikan access token dan cookie refresh", async () => {
  const { response, data } = await request("/login", {
    method: "POST",
    body: { email: TEST_EMAIL.toUpperCase(), password: TEST_PASSWORD },
  });

  assert.equal(response.status, 200);
  assert.ok(data.accessToken);
  assert.equal(data.tokenType, "Bearer");
  assert.equal(data.user.email, TEST_EMAIL);

  const setCookie = response.headers.getSetCookie().join(";");
  assert.match(setCookie, new RegExp(REFRESH_COOKIE_NAME));
  assert.match(setCookie, /HttpOnly/i);

  accessToken = data.accessToken;
  refreshCookie = readCookie(response, REFRESH_COOKIE_NAME);
  assert.ok(refreshCookie);
});

test("GET /me mengembalikan user dengan access token yang valid", async () => {
  const { response, data } = await request("/me", { token: accessToken });

  assert.equal(response.status, 200);
  assert.equal(data.user.email, TEST_EMAIL);
});

test("GET /me tanpa access token ditolak 401", async () => {
  const { response, data } = await request("/me");

  assert.equal(response.status, 401);
  assert.match(data.message, /token autentikasi/i);
});

test("refresh memutar token dan menerbitkan access token baru", async () => {
  const firstToken = refreshCookie;
  rotatedAwayToken = firstToken;

  const { response, data } = await request("/refresh", {
    method: "POST",
    cookie: firstToken,
  });

  assert.equal(response.status, 200);
  assert.ok(data.accessToken);

  const nextToken = readCookie(response, REFRESH_COOKIE_NAME);
  assert.ok(nextToken);
  assert.notEqual(nextToken, firstToken);

  refreshCookie = nextToken;
});

test("refresh dengan token lama yang sudah diputar ditolak 401", async () => {
  const { response } = await request("/refresh", {
    method: "POST",
    cookie: rotatedAwayToken,
  });

  assert.equal(response.status, 401);
});

test("logout menghapus sesi sehingga refresh berikutnya ditolak 401", async () => {
  const logoutResponse = await request("/logout", {
    method: "POST",
    cookie: refreshCookie,
  });

  assert.equal(logoutResponse.response.status, 200);

  const { response } = await request("/refresh", {
    method: "POST",
    cookie: refreshCookie,
  });

  assert.equal(response.status, 401);
});
