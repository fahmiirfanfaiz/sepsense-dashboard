import * as dashboardService from "../services/dashboard.service.js";

/**
 * GET /api/dashboard/beds
 * Mengembalikan daftar semua bed (device aktif) dengan risk score terkini.
 */
export async function listBeds(req, res) {
  const beds = await dashboardService.listBedOverview();
  return res.status(200).json({ beds });
}

/**
 * GET /api/dashboard/device/:deviceId
 * Mengembalikan detail lengkap satu device: sensor readings, AI prediction, pasien.
 */
export async function getDeviceDetail(req, res) {
  const { deviceId } = req.params;
  const detail = await dashboardService.getDeviceDetail(deviceId);
  return res.status(200).json(detail);
}

/**
 * GET /api/dashboard/device/:deviceId/patient
 * Melihat identitas pasien saat ini.
 */
export async function getPatient(req, res) {
  const { deviceId } = req.params;
  const patient = await dashboardService.getPatientDetail(deviceId);
  return res.status(200).json({ patient });
}

/**
 * POST /api/dashboard/device/:deviceId/patient
 * PATCH /api/dashboard/device/:deviceId/patient
 * Body: { name, medicalRecordNo, roomBed, birthDate }
 * Menambahkan atau memperbarui identitas pasien lengkap.
 */
export async function savePatient(req, res) {
  const { deviceId } = req.params;
  const { name, medicalRecordNo, roomBed, birthDate } = req.body;

  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return res.status(422).json({
      message: "Nama pasien tidak boleh kosong.",
      code: "INVALID_PATIENT_NAME",
    });
  }

  const result = await dashboardService.upsertPatient(deviceId, {
    name,
    medicalRecordNo,
    roomBed,
    birthDate,
  });
  return res.status(200).json(result);
}

/**
 * DELETE /api/dashboard/device/:deviceId/patient
 * Menghapus/mereset identitas pasien pada device.
 */
export async function deletePatient(req, res) {
  const { deviceId } = req.params;
  const result = await dashboardService.deletePatient(deviceId);
  return res.status(200).json(result);
}

/**
 * PATCH /api/dashboard/device/:deviceId/patient-name
 * Body: { name: string }
 * Memperbarui nama pasien secara manual oleh tenaga kesehatan.
 */
export async function updatePatientName(req, res) {
  const { deviceId } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(422).json({
      message: "Nama pasien tidak boleh kosong.",
      code: "INVALID_PATIENT_NAME",
    });
  }

  const result = await dashboardService.updatePatientName(deviceId, name);
  return res.status(200).json(result);
}
