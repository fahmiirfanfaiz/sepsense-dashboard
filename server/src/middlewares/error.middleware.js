import { AppError } from "../utils/AppError.js";
import { isUniqueViolation } from "../utils/dbErrors.js";

export function notFoundHandler(req, _res, next) {
  next(
    new AppError(
      404,
      `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`,
      "ROUTE_NOT_FOUND",
    ),
  );
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;

  let statusCode = error instanceof AppError ? error.statusCode : 500;
  let message = error instanceof AppError
    ? error.message
    : "Terjadi kesalahan pada server.";
  let code = error instanceof AppError ? error.code : undefined;
  let details = error instanceof AppError ? error.details : undefined;

  // Body JSON yang rusak dari express.json()
  if (
    error?.type === "entity.parse.failed" ||
    (error instanceof SyntaxError && error?.status === 400 && "body" in error)
  ) {
    statusCode = 400;
    message = "Format JSON pada request tidak valid.";
    code = "INVALID_JSON";
  }

  // Race condition dua request register dengan email yang sama.
  if (isUniqueViolation(error)) {
    statusCode = 409;
    message = "Email sudah terdaftar. Silakan masuk.";
    code = "EMAIL_ALREADY_EXISTS";
    details = undefined;
  }

  if (statusCode >= 500) {
    console.error(
      `[ERROR] ${req.method} ${req.originalUrl} - ${error?.name}: ${error?.message}`,
      error,
    );
    message = "Terjadi kesalahan pada server.";
    code = "INTERNAL_SERVER_ERROR";
  }

  const payload = { message };

  if (code) payload.code = code;
  if (details) payload.errors = details;

  res.status(statusCode).json(payload);
}
