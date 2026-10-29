import { db } from "../prisma/db.ts";

/**
 * Mengembalikan semua sesi monitoring yang sedang aktif (endedAt IS NULL)
 * beserta relasi device, patient, dan risk assessment terakhir dari setiap sesi.
 */
export const dashboardRepository = {
  /**
   * Ambil seluruh sesi aktif dengan info device, pasien, dan risk assessment terbaru.
   */
  async findActiveSessions() {
    const sessions = await db.orm.public.MonitoringSession.where({ endedAt: null })
      .include("device")
      .include("patient")
      .all();

    return sessions;
  },

  /**
   * Ambil sesi aktif milik satu device tertentu.
   */
  async findActiveSessionByDeviceId(deviceId) {
    const session = await db.orm.public.MonitoringSession.where({
      deviceId: Number(deviceId),
      endedAt: null,
    })
      .include("device")
      .include("patient")
      .first();

    if (!session) return null;

    const latestAi = await db.orm.public.AiPrediction.where({
      sessionId: session.id,
    })
      .orderBy((r) => r.windowEnd.desc())
      .first();

    return {
      ...session,
      aiPredictions: latestAi ? [latestAi] : [],
    };
  },

  /**
   * Ambil risk assessment terbaru dari sesi tertentu.
   */
  async findLatestRiskAssessmentForSession(sessionId) {
    const reading = await db.orm.public.VitalReading.where({ sessionId: Number(sessionId) })
      .include("assessment")
      .orderBy((r) => r.recordedAt.desc())
      .first();

    return reading?.assessment ?? null;
  },

  /**
   * Ambil N bacaan sensor terbaru dari sesi tertentu.
   */
  async findRecentReadingsForSession(sessionId, limit = 60) {
    const readings = await db.orm.public.VitalReading.where({
      sessionId: Number(sessionId),
    })
      .include("assessment")
      .orderBy((r) => r.recordedAt.desc())
      .limit(limit)
      .all();

    // Kembalikan dalam urutan ascending agar chart bisa di-plot dari kiri ke kanan
    return readings.reverse();
  },

  /**
   * Ambil semua device (aktif) dengan sesi aktifnya jika ada.
   */
  async findAllDevicesWithActiveSession() {
    const devices = await db.orm.public.Device.where({ isActive: true }).all();

    const activeSessions = await db.orm.public.MonitoringSession.where({ endedAt: null })
      .include("patient")
      .all();

    const sessionByDeviceId = new Map(
      activeSessions.map((s) => [s.deviceId, s]),
    );

    return devices.map((d) => ({
      device: d,
      session: sessionByDeviceId.get(d.id) ?? null,
    }));
  },

  /**
   * Update nama pasien secara manual oleh tenaga kesehatan.
   */
  async updatePatientName(patientId, name) {
    return db.orm.public.Patient.where({ id: Number(patientId) }).update({ name });
  },

  /**
   * Update identitas pasien lengkap.
   */
  async updatePatient(patientId, { name, medicalRecordNo, roomBed, birthDate }) {
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (medicalRecordNo !== undefined) updateData.medicalRecordNo = medicalRecordNo;
    if (roomBed !== undefined) updateData.roomBed = roomBed;
    if (birthDate !== undefined) updateData.birthDate = birthDate;
    return db.orm.public.Patient.where({ id: Number(patientId) }).update(updateData);
  },

  /**
   * Cari data pasien berdasarkan ID.
   */
  async findPatientById(patientId) {
    return db.orm.public.Patient.where({ id: Number(patientId) }).first();
  },

  /**
   * Buat pasien baru dan mulai sesi baru jika diperlukan.
   */
  async createPatient({ medicalRecordNo, name, roomBed, birthDate }) {
    return db.orm.public.Patient.create({
      medicalRecordNo,
      name,
      roomBed: roomBed ?? null,
      birthDate: birthDate ?? null,
    });
  },

  /**
   * Reset / Hapus identitas pasien dari sesi.
   */
  async deletePatient(patientId) {
    // Setel ulang nama pasien menjadi default atau unassigned
    return db.orm.public.Patient.where({ id: Number(patientId) }).update({
      name: "Belum Diisi",
      medicalRecordNo: `RM-${Date.now().toString().slice(-6)}`,
      roomBed: null,
    });
  },
};
