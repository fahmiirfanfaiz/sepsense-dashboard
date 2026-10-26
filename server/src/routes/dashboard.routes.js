import { Router } from "express";
import * as dashboardController from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Semua endpoint dashboard memerlukan autentikasi
router.use(requireAuth);

/**
 * GET /api/dashboard/beds
 * Daftar semua bed aktif dan risk score terkini.
 */
router.get("/beds", asyncHandler(dashboardController.listBeds));

/**
 * GET /api/dashboard/device/:deviceId
 * Detail lengkap satu device.
 */
router.get("/device/:deviceId", asyncHandler(dashboardController.getDeviceDetail));

/**
 * PATCH /api/dashboard/device/:deviceId/patient-name
 * Perbarui nama pasien secara manual.
 */
router.patch(
  "/device/:deviceId/patient-name",
  asyncHandler(dashboardController.updatePatientName),
);

export default router;
