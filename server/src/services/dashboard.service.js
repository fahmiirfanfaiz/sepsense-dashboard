import { dashboardRepository } from "../repositories/dashboard.repository.js";
import { AppError } from "../utils/AppError.js";
import { db } from "../prisma/db.ts";
import { getIO } from "../configs/socket.js";

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
 * Mengambil data pasien dari device tertentu.
 */
export async function getPatientDetail(deviceId) {
  const session = await dashboardRepository.findActiveSessionByDeviceId(deviceId);
  if (!session?.patient) {
    return null;
  }
  return session.patient;
}

/**
 * Buat atau perbarui identitas pasien (CRUD: Create & Update).
 */
export async function upsertPatient(deviceId, { name, medicalRecordNo, roomBed, birthDate }) {
  const deviceIdNum = Number(deviceId);
  if (isNaN(deviceIdNum)) {
    throw new AppError(400, "Device ID tidak valid.", "INVALID_DEVICE_ID");
  }

  let session = await dashboardRepository.findActiveSessionByDeviceId(deviceIdNum);

  if (!session) {
    // Cari atau buat device jika belum ada
    let device = await db.orm.public.Device.where({ id: deviceIdNum }).first();
    if (!device) {
      device = await db.orm.public.Device.create({
        id: deviceIdNum,
        deviceCode: `SEPSENSE_0${deviceIdNum}`,
        label: `Bed ${deviceIdNum}`,
        isActive: true,
      });
    }

    const doctor = await db.orm.public.User.first();
    const newPatient = await db.orm.public.Patient.create({
      name: name?.trim() || `Pasien Bed ${deviceIdNum}`,
      medicalRecordNo: medicalRecordNo?.trim() || `RM-${String(deviceIdNum).padStart(3, "0")}-${Date.now().toString().slice(-4)}`,
      roomBed: roomBed?.trim() || `ICU - Bed ${deviceIdNum}`,
      birthDate: birthDate || null,
    });

    session = await db.orm.public.MonitoringSession.create({
      deviceId: device.id,
      patientId: newPatient.id,
      startedBy: doctor ? doctor.id : 1,
      startedAt: new Date().toISOString(),
    });
    session = { ...session, patient: newPatient };
  } else if (session.patient) {
    await dashboardRepository.updatePatient(session.patient.id, {
      name: name !== undefined ? name.trim() : undefined,
      medicalRecordNo: medicalRecordNo !== undefined ? medicalRecordNo.trim() : undefined,
      roomBed: roomBed !== undefined ? roomBed.trim() : undefined,
      birthDate: birthDate !== undefined ? birthDate : undefined,
    });
  }

  // Notifikasi update via Socket.IO
  try {
    const io = getIO();
    const updatedPatient = await dashboardRepository.findPatientById(session.patientId);
    io.emit("device:patient_update", { deviceId: deviceIdNum, patient: updatedPatient });
    io.to(`device:${deviceIdNum}`).emit("device:patient_update", { deviceId: deviceIdNum, patient: updatedPatient });
    const overviewBeds = await listBedOverview();
    io.to("overview").emit("overview:data", { beds: overviewBeds });
  } catch (ioErr) {
    // ignore
  }

  return { success: true };
}

/**
 * Perbarui nama pasien yang sedang dimonitor oleh device tertentu.
 */
export async function updatePatientName(deviceId, name) {
  return upsertPatient(deviceId, { name });
}

/**
 * Hapus / Reset identitas pasien dari device (CRUD: Delete).
 */
export async function deletePatient(deviceId) {
  const deviceIdNum = Number(deviceId);
  const session = await dashboardRepository.findActiveSessionByDeviceId(deviceIdNum);

  if (!session?.patient) {
    throw new AppError(404, "Tidak ada pasien terdaftar untuk device ini.", "NO_PATIENT");
  }

  await dashboardRepository.deletePatient(session.patient.id);

  // Notifikasi via Socket.IO
  try {
    const io = getIO();
    const updatedPatient = await dashboardRepository.findPatientById(session.patientId);
    io.emit("device:patient_update", { deviceId: deviceIdNum, patient: updatedPatient });
    io.to(`device:${deviceIdNum}`).emit("device:patient_update", { deviceId: deviceIdNum, patient: updatedPatient });
    const overviewBeds = await listBedOverview();
    io.to("overview").emit("overview:data", { beds: overviewBeds });
  } catch {
    // ignore
  }

  return { success: true, message: "Identitas pasien berhasil direset." };
}
