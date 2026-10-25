import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  loginLimiter,
  refreshLimiter,
  registerLimiter,
} from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loginSchema, registerSchema } from "../validators/auth.validator.js";

const router = Router();

// Response autentikasi tidak boleh disimpan oleh browser/proxy.
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Path root dipertahankan agar cocok dengan pemanggilan frontend saat ini:
// POST ${NEXT_PUBLIC_API_BASE_URL}/register dan /login.
router.post(
  "/register",
  registerLimiter,
  validate(registerSchema),
  asyncHandler(authController.register),
);

router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  asyncHandler(authController.login),
);

router.post(
  "/refresh",
  refreshLimiter,
  asyncHandler(authController.refresh),
);

router.post("/logout", asyncHandler(authController.logout));

router.get("/me", requireAuth, asyncHandler(authController.me));

export default router;
