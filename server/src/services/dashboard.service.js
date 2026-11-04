import { dashboardRepository } from "../repositories/dashboard.repository.js";
import { AppError } from "../utils/AppError.js";
import { db } from "../prisma/db.js";
import { getIO } from "../configs/socket.js";
import { clearDeviceContextCache } from "../handlers/mqttHandler.js";

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

  let hwCounter = 1;
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

      // Bed Default untuk simulator (Device ID 1 / default),
      // dan Bed 1 - n untuk hardware devices lain jika belum ada custom label
      let computedLabel;
      const isSimulator = device.id === 1 || String(device.deviceCode).toUpperCase().includes("DEFAULT");
      if (isSimulator) {
        computedLabel = (device.label && device.label !== "Bed 1") ? device.label : "Bed Default";
      } else {
        computedLabel = device.label || `Bed ${hwCounter++}`;
      }

      return {
        deviceId: device.id,
        deviceCode: device.deviceCode,
        label: computedLabel,
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
      label: "Bed Default",
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
  const entry = devices.find((e) => e.device.id === Number(deviceId) || String(e.device.deviceCode) === String(deviceId));

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

  let computedLabel;
  const isSimulator = device.id === 1 || String(device.deviceCode).toUpperCase().includes("DEFAULT");
  if (isSimulator) {
    computedLabel = (device.label && device.label !== "Bed 1") ? device.label : "Bed Default";
  } else {
    computedLabel = device.label || `Bed ${deviceId}`;
  }

  return {
    deviceId: device.id,
    deviceCode: device.deviceCode,
    label: computedLabel,
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

  // Invalidate in-memory device context cache agar telemetri langsung menggunakan data terbaru
  try {
    clearDeviceContextCache(deviceIdNum);
  } catch {
    // ignore
  }

  const updatedPatient = await dashboardRepository.findPatientById(session.patientId);

  // Notifikasi update via Socket.IO
  try {
    const io = getIO();
    io.emit("device:patient_update", { deviceId: deviceIdNum, patient: updatedPatient });
    io.to(`device:${deviceIdNum}`).emit("device:patient_update", { deviceId: deviceIdNum, patient: updatedPatient });
    const overviewBeds = await listBedOverview();
    io.to("overview").emit("overview:data", { beds: overviewBeds });
  } catch (ioErr) {
    // ignore
  }

  return { success: true, patient: updatedPatient };
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

  try {
    clearDeviceContextCache(deviceIdNum);
  } catch {
    // ignore
  }

  const updatedPatient = await dashboardRepository.findPatientById(session.patientId);

  // Notifikasi via Socket.IO
  try {
    const io = getIO();
    io.emit("device:patient_update", { deviceId: deviceIdNum, patient: updatedPatient });
    io.to(`device:${deviceIdNum}`).emit("device:patient_update", { deviceId: deviceIdNum, patient: updatedPatient });
    const overviewBeds = await listBedOverview();
    io.to("overview").emit("overview:data", { beds: overviewBeds });
  } catch {
    // ignore
  }

  return { success: true, patient: updatedPatient, message: "Identitas pasien berhasil direset." };
}

/**
 * Buat Bed baru (CRUD: Create).
 */
export async function createBed({ label, deviceCode, initialPatientName }) {
  // Hitung jumlah hardware devices yang ada untuk default label (1 - n)
  const allDevices = await db.orm.public.Device.where({ isActive: true }).all();
  const hwCount = allDevices.filter(
    (d) => d.id !== 1 && !String(d.deviceCode).toUpperCase().includes("DEFAULT") && d.label !== "Bed Default"
  ).length;

  const finalLabel = label?.trim() || `Bed ${hwCount + 1}`;
  const finalCode = deviceCode?.trim() || `SEPSENSE_${String(Date.now()).slice(-4)}`;

  const existingCode = await db.orm.public.Device.where({ deviceCode: finalCode }).first();
  if (existingCode) {
    throw new AppError(409, `Kode perangkat "${finalCode}" sudah digunakan.`, "DUPLICATE_DEVICE_CODE");
  }

  const device = await db.orm.public.Device.create({
    deviceCode: finalCode,
    label: finalLabel,
    isActive: true,
  });

  const doctor = await db.orm.public.User.first();
  const patient = await db.orm.public.Patient.create({
    name: initialPatientName?.trim() || `Pasien ${finalLabel}`,
    medicalRecordNo: `RM-${String(device.id).padStart(3, "0")}`,
    roomBed: `ICU - ${finalLabel}`,
  });

  const session = await db.orm.public.MonitoringSession.create({
    deviceId: device.id,
    patientId: patient.id,
    startedBy: doctor ? doctor.id : 1,
    startedAt: new Date().toISOString(),
  });

  try {
    clearDeviceContextCache(device.id);
    const io = getIO();
    const overviewBeds = await listBedOverview();
    io.to("overview").emit("overview:data", { beds: overviewBeds });
  } catch {}

  return { success: true, device, session, patient };
}

/**
 * Perbarui metadata Bed (CRUD: Update - Nama Bed, Kode Perangkat, Sesi ID).
 */
export async function updateBed(deviceId, { label, deviceCode, sessionId, startNewSession }) {
  const deviceIdNum = Number(deviceId);
  if (isNaN(deviceIdNum)) {
    throw new AppError(400, "Device ID tidak valid.", "INVALID_DEVICE_ID");
  }

  const device = await db.orm.public.Device.where({ id: deviceIdNum }).first();
  if (!device) {
    throw new AppError(404, "Bed / Device tidak ditemukan.", "DEVICE_NOT_FOUND");
  }

  const updateData = {};
  if (label !== undefined && label.trim().length > 0) {
    updateData.label = label.trim();
  }
  if (deviceCode !== undefined && deviceCode.trim().length > 0) {
    const trimmedCode = deviceCode.trim();
    if (trimmedCode !== device.deviceCode) {
      const codeCheck = await db.orm.public.Device.where({ deviceCode: trimmedCode }).first();
      if (codeCheck && codeCheck.id !== deviceIdNum) {
        throw new AppError(409, `Kode perangkat "${trimmedCode}" sudah digunakan oleh bed lain.`, "DUPLICATE_DEVICE_CODE");
      }
      updateData.deviceCode = trimmedCode;
    }
  }

  if (Object.keys(updateData).length > 0) {
    await db.orm.public.Device.where({ id: deviceIdNum }).update(updateData);
  }

  // Pengelolaan Sesi ID
  let activeSession = await dashboardRepository.findActiveSessionByDeviceId(deviceIdNum);

  if (startNewSession) {
    // Akhiri sesi lama jika ada
    const nowIso = new Date().toISOString();
    if (activeSession) {
      await db.orm.public.MonitoringSession.where({ id: activeSession.id }).update({ endedAt: nowIso });
    }

    const doctor = await db.orm.public.User.first();
    const patient = activeSession?.patient ?? await db.orm.public.Patient.create({
      name: `Pasien ${updateData.label || device.label || `Bed ${deviceIdNum}`}`,
      medicalRecordNo: `RM-${String(deviceIdNum).padStart(3, "0")}`,
      roomBed: `ICU - ${updateData.label || device.label || `Bed ${deviceIdNum}`}`,
    });

    activeSession = await db.orm.public.MonitoringSession.create({
      deviceId: deviceIdNum,
      patientId: patient.id,
      startedBy: doctor ? doctor.id : 1,
      startedAt: nowIso,
    });
  } else if (sessionId !== undefined && sessionId !== null) {
    const targetSessionId = Number(sessionId);
    if (!isNaN(targetSessionId) && (!activeSession || activeSession.id !== targetSessionId)) {
      const targetSession = await db.orm.public.MonitoringSession.where({ id: targetSessionId, deviceId: deviceIdNum }).first();
      if (targetSession) {
        if (activeSession) {
          await db.orm.public.MonitoringSession.where({ id: activeSession.id }).update({ endedAt: new Date().toISOString() });
        }
        await db.orm.public.MonitoringSession.where({ id: targetSessionId }).update({ endedAt: null });
        activeSession = targetSession;
      }
    }
  }

  try {
    clearDeviceContextCache(deviceIdNum);
    const io = getIO();
    const overviewBeds = await listBedOverview();
    io.to("overview").emit("overview:data", { beds: overviewBeds });
    const detail = await getDeviceDetail(deviceIdNum);
    io.emit("device:status", detail);
  } catch {}

  const updatedDevice = await db.orm.public.Device.where({ id: deviceIdNum }).first();
  return { success: true, device: updatedDevice, session: activeSession };
}

/**
 * Hapus / Nonaktifkan Bed (CRUD: Delete).
 */
export async function deleteBed(deviceId) {
  const deviceIdNum = Number(deviceId);
  if (isNaN(deviceIdNum)) {
    throw new AppError(400, "Device ID tidak valid.", "INVALID_DEVICE_ID");
  }

  const device = await db.orm.public.Device.where({ id: deviceIdNum }).first();
  if (!device) {
    throw new AppError(404, "Bed / Device tidak ditemukan.", "DEVICE_NOT_FOUND");
  }

  // Akhiri sesi aktif
  const activeSession = await dashboardRepository.findActiveSessionByDeviceId(deviceIdNum);
  if (activeSession) {
    await db.orm.public.MonitoringSession.where({ id: activeSession.id }).update({ endedAt: new Date().toISOString() });
  }

  // Set nonaktif
  await db.orm.public.Device.where({ id: deviceIdNum }).update({ isActive: false });

  try {
    clearDeviceContextCache(deviceIdNum);
    const io = getIO();
    const overviewBeds = await listBedOverview();
    io.to("overview").emit("overview:data", { beds: overviewBeds });
  } catch {}

  return { success: true, message: `Bed ${device.label || deviceIdNum} berhasil dinonaktifkan.` };
}
