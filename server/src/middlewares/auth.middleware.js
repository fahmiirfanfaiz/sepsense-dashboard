import { AppError } from "../utils/AppError.js";
import { verifyAccessToken } from "../utils/tokens.js";

export function requireAuth(req, _res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return next(
      new AppError(
        401,
        "Token autentikasi tidak ditemukan. Silakan masuk terlebih dahulu.",
        "MISSING_ACCESS_TOKEN",
      ),
    );
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return next(
      new AppError(
        401,
        "Token autentikasi tidak ditemukan. Silakan masuk terlebih dahulu.",
        "MISSING_ACCESS_TOKEN",
      ),
    );
  }

  const payload = verifyAccessToken(token);
  const userId = Number(payload.sub);

  if (!Number.isInteger(userId) || userId <= 0) {
    return next(
      new AppError(401, "Token autentikasi tidak valid.", "INVALID_ACCESS_TOKEN"),
    );
  }

  req.user = {
    id: userId,
    email: typeof payload.email === "string" ? payload.email : undefined,
    role: typeof payload.role === "string" ? payload.role : undefined,
  };

  return next();
}
