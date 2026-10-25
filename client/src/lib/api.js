/**
 * Sepsense API Client & Authentication Layer
 * Menyediakan interseptor token, silent refresh otomatis, dan helper autentikasi.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

const ACCESS_TOKEN_KEY = "sepsense_access_token";
const USER_KEY = "sepsense_user";

export function getStoredAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setStoredAccessToken(token) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Single-flight refresh token queue
let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(newToken) {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
}

function onRefreshFailed(error) {
  refreshSubscribers.forEach((callback) => callback(null, error));
  refreshSubscribers = [];
}

/**
 * Wrapper fetch terproteksi dengan silent token refresh.
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  const accessToken = getStoredAccessToken();

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const fetchOptions = {
    ...options,
    headers,
    credentials: "include", // Selalu kirim cookie httpOnly (refresh token)
  };

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
  }

  // Jika response 401 dan bukan endpoint auth, lakukan silent refresh
  const isAuthRoute =
    endpoint.includes("/login") ||
    endpoint.includes("/register") ||
    endpoint.includes("/refresh");

  if (response.status === 401 && !options._retry && !isAuthRoute) {
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setStoredAccessToken(refreshData.accessToken);
          if (refreshData.user) setStoredUser(refreshData.user);

          isRefreshing = false;
          onRefreshed(refreshData.accessToken);

          // Ulangi request awal dengan token baru
          return apiFetch(endpoint, { ...options, _retry: true });
        } else {
          // Sesi refresh token sudah hangus/invalid
          isRefreshing = false;
          clearSession();
          onRefreshFailed(new Error("Sesi telah berakhir"));
          if (typeof window !== "undefined" && window.location.pathname !== "/login") {
            // Hard redirect diperlukan di level fetch helper agar seluruh state memori ter-reset bersih
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/login";
          }
          return response;
        }
      } catch (refreshErr) {
        isRefreshing = false;
        clearSession();
        onRefreshFailed(refreshErr);
        throw refreshErr;
      }
    }

    // Request lain yang datang bersamaan akan menunggu refresh pertama selesai
    return new Promise((resolve, reject) => {
      refreshSubscribers.push((newToken, err) => {
        if (err || !newToken) {
          return resolve(response);
        }
        resolve(apiFetch(endpoint, { ...options, _retry: true }));
      });
    });
  }

  return response;
}

/**
 * Service Auth API
 */
export const authApi = {
  async register({ name, email, role, password }) {
    const res = await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, role, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.message || "Registrasi gagal.");
      error.status = res.status;
      error.errors = data.errors;
      error.code = data.code;
      throw error;
    }
    return data;
  },

  async login({ email, password }) {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.message || "Email atau password salah.");
      error.status = res.status;
      error.code = data.code;
      throw error;
    }

    if (data.accessToken) {
      setStoredAccessToken(data.accessToken);
    }
    if (data.user) {
      setStoredUser(data.user);
    }

    return data;
  },

  async logout() {
    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
    } finally {
      clearSession();
    }
  },

  async getMe() {
    const res = await apiFetch("/me", { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Gagal memuat profil user.");
    }
    if (data.user) {
      setStoredUser(data.user);
    }
    return data.user;
  },
};
