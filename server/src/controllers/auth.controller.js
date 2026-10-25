import * as authService from "../services/auth.service.js";
import {
  clearRefreshCookie,
  getRefreshCookie,
  setRefreshCookie,
} from "../utils/cookies.js";

export async function register(req, res) {
  const { user } = await authService.register(req.validatedBody);

  res.status(201).json({
    message: "Registrasi berhasil. Silakan masuk.",
    user,
  });
}

export async function login(req, res) {
  const session = await authService.login(req.validatedBody);

  setRefreshCookie(res, session.refreshToken);

  res.status(200).json({
    message: "Login berhasil.",
    user: session.user,
    accessToken: session.accessToken,
    tokenType: session.tokenType,
    expiresIn: session.expiresIn,
  });
}

export async function refresh(req, res) {
  const session = await authService.refreshSession(getRefreshCookie(req));

  setRefreshCookie(res, session.refreshToken);

  res.status(200).json({
    message: "Sesi berhasil diperbarui.",
    user: session.user,
    accessToken: session.accessToken,
    tokenType: session.tokenType,
    expiresIn: session.expiresIn,
  });
}

export async function logout(req, res) {
  await authService.logout(getRefreshCookie(req));
  clearRefreshCookie(res);

  res.status(200).json({
    message: "Logout berhasil.",
  });
}

export async function me(req, res) {
  const user = await authService.getCurrentUser(req.user.id);

  res.status(200).json({ user });
}
