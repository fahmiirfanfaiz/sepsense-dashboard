import { REFRESH_COOKIE_NAME } from "../configs/constants.js";
import { env } from "../configs/env.js";

const baseCookieOptions = Object.freeze({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: "/",
});

export function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...baseCookieOptions,
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions);
}

export function getRefreshCookie(req) {
  return req.cookies?.[REFRESH_COOKIE_NAME] ?? null;
}
