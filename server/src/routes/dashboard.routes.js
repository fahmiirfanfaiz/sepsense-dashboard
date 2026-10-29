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
 * GET /api/dashboard/device/:deviceId/patient
 * Melihat identitas pasien saat ini.
 */
router.get("/device/:deviceId/patient", asyncHandler(dashboardController.getPatient));

/**
 * POST /api/dashboard/device/:deviceId/patient
 * Tambahkan atau buat identitas pasien.
 */
router.post("/device/:deviceId/patient", asyncHandler(dashboardController.savePatient));

/**
 * PATCH /api/dashboard/device/:deviceId/patient
 * Perbarui identitas pasien lengkap.
 */
router.patch("/device/:deviceId/patient", asyncHandler(dashboardController.savePatient));

/**
 * DELETE /api/dashboard/device/:deviceId/patient
 * Hapus / reset identitas pasien.
 */
router.delete("/device/:deviceId/patient", asyncHandler(dashboardController.deletePatient));

/**
 * PATCH /api/dashboard/device/:deviceId/patient-name
 * Perbarui nama pasien secara manual (backward compatibility).
 */
router.patch(
  "/device/:deviceId/patient-name",
  asyncHandler(dashboardController.updatePatientName),
);

export default router;
