import { dashboardRepository } from "../repositories/dashboard.repository.js";
import { AppError } from "../utils/AppError.js";

/**
 * RISK_SCORE mapping:
 *  0  → AMAN     (hijau)
 *  1  → WASPADA  (kuning)
 *  2+ → RISIKO   (merah / potensi sepsis)
 */

/**
 * Kembalikan daftar semua device aktif beserta sesi aktif & risk score terkini.
 * Jika tidak ada device terdaftar, kembalikan satu entry default "dummy".
 */
export async function listBedOverview() {
  const entries = await dashboardRepository.findAllDevicesWithActiveSession();

  // Jika sama sekali tidak ada device, tampilkan 1 baris default agar
  // tenaga kesehatan tetap bisa mengakses halaman detail "kosong".
  if (entries.length === 0) {
    return [
      {
        deviceId: "default",
        deviceCode: "N/A",
        label: "Bed 1",
        isConnected: false,
        lastHeartbeatAt: null,
        session: null,
        patient: null,
        latestRiskAssessment: null,
      },
    ];
  }

  const result = await Promise.all(
    entries.map(async ({ device, session }, index) => {
      let latestRiskAssessment = null;

      if (session) {
        latestRiskAssessment = await dashboardRepository.findLatestRiskAssessmentForSession(
          session.id,
        );
      }

      // Device dianggap "terhubung" jika heartbeat terakhir ≤ 30 detik yang lalu
      const isConnected = device.lastHeartbeatAt
        ? Date.now() - new Date(device.lastHeartbeatAt).getTime() <= 30_000
        : false;

      return {
        deviceId: device.id,
        deviceCode: device.deviceCode,
        label: device.label ?? `Bed ${index + 1}`,
        isConnected,
        lastHeartbeatAt: device.lastHeartbeatAt,
        sensorStatus: {
          max30102: device.statusMax30102,
          mpu6050: device.statusMpu6050,
          mlx90614: device.statusMlx90614,
        },
        session: session
          ? { id: session.id, startedAt: session.startedAt }
          : null,
        patient: session?.patient
          ? {
              id: session.patient.id,
              name: session.patient.name,
              medicalRecordNo: session.patient.medicalRecordNo,
              roomBed: session.patient.roomBed,
            }
          : null,
        latestRiskAssessment,
      };
    }),
  );

  return result;
}

/**
 * Detail satu device: sesi aktif, 60 bacaan sensor terakhir, AI prediction terbaru.
 */
export async function getDeviceDetail(deviceId) {
  if (deviceId === "default") {
    // Mode demo — tidak ada data nyata
    return {
      deviceId: "default",
      deviceCode: "N/A",
      label: "Bed 1 (Default)",
      isConnected: false,
      lastHeartbeatAt: null,
      sensorStatus: { max30102: false, mpu6050: false, mlx90614: false },
      session: null,
      patient: null,
      readings: [],
      latestRiskAssessment: null,
      latestAiPrediction: null,
    };
  }

  const session = await dashboardRepository.findActiveSessionByDeviceId(deviceId);

  // Cari device langsung jika tidak ada sesi aktif
  const devices = await dashboardRepository.findAllDevicesWithActiveSession();
  const entry = devices.find((e) => e.device.id === Number(deviceId));

  if (!entry) {
    throw new AppError(404, "Device tidak ditemukan.", "DEVICE_NOT_FOUND");
  }

  const { device } = entry;

  const isConnected = device.lastHeartbeatAt
    ? Date.now() - new Date(device.lastHeartbeatAt).getTime() <= 30_000
    : false;

  let readings = [];
  let latestRiskAssessment = null;
  let latestAiPrediction = null;
  let patient = null;

  if (session) {
    [readings, latestRiskAssessment] = await Promise.all([
      dashboardRepository.findRecentReadingsForSession(session.id, 60),
      dashboardRepository.findLatestRiskAssessmentForSession(session.id),
    ]);

    // AI prediction terakhir (sudah di-include di query findActiveSessionByDeviceId)
    latestAiPrediction = session.aiPredictions?.[0] ?? null;

    patient = session.patient
      ? {
          id: session.patient.id,
          name: session.patient.name,
          medicalRecordNo: session.patient.medicalRecordNo,
          birthDate: session.patient.birthDate,
          roomBed: session.patient.roomBed,
        }
      : null;
  }

  return {
    deviceId: device.id,
    deviceCode: device.deviceCode,
    label: device.label ?? `Bed ${deviceId}`,
    isConnected,
    lastHeartbeatAt: device.lastHeartbeatAt,
    sensorStatus: {
      max30102: device.statusMax30102,
      mpu6050: device.statusMpu6050,
      mlx90614: device.statusMlx90614,
    },
    session: session ? { id: session.id, startedAt: session.startedAt } : null,
    patient,
    readings,
    latestRiskAssessment,
    latestAiPrediction,
  };
}

/**
 * Perbarui nama pasien yang sedang dimonitor oleh device tertentu.
 */
export async function updatePatientName(deviceId, name) {
  const session = await dashboardRepository.findActiveSessionByDeviceId(deviceId);

  if (!session?.patient) {
    throw new AppError(
      404,
      "Tidak ada sesi aktif atau pasien terdaftar untuk device ini.",
      "NO_ACTIVE_SESSION",
    );
  }

  await dashboardRepository.updatePatientName(session.patient.id, name.trim());
  return { success: true };
}
