#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/443e759a3af0ff1bd71f82213cc940767fbbb4910a8488349dcb926974d3c0f6/contract';
import endContract from '../../snapshots/443e759a3af0ff1bd71f82213cc940767fbbb4910a8488349dcb926974d3c0f6/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'ai_predictions',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('model_version', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('predicted_label', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('probability', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('session_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('window_end', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('window_start', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'alerts',
        columns: [
          col('acknowledged_at', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('acknowledged_by', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('risk_assessment_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('session_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('triggered_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'alerts_status_check_8c31f1e5',
            sql`"status" IN ('ACTIVE', 'ACKNOWLEDGED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'devices',
        columns: [
          col('device_code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('is_active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('label', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('last_heartbeat_at', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('status_max30102', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('status_mlx90614', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('status_mpu6050', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'monitoring_sessions',
        columns: [
          col('device_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('ended_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('patient_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('started_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('started_by', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'patients',
        columns: [
          col('birth_date', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('medical_record_no', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('room_bed', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'refresh_tokens',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expires_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('token_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'risk_assessments',
        columns: [
          col('c1_hr', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('c2_rr', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('c3_temp', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('c4_spo2', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('evaluated_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('risk_level', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('risk_score', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('vital_reading_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'risk_assessments_risk_level_check_84946b5d',
            sql`"risk_level" IN ('AMAN', 'WASPADA', 'RISIKO')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'users',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('password_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'users_role_check_5b119231',
            sql`"role" IN ('DOKTER', 'PERAWAT', 'APOTEKER')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'vital_readings',
        columns: [
          col('heart_rate', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('received_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('recorded_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('respiratory_rate', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('session_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('spo2', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('temperature', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'alerts',
        constraint: 'alerts_risk_assessment_id_key',
        columns: ['risk_assessment_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'devices',
        constraint: 'devices_device_code_key',
        columns: ['device_code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'patients',
        constraint: 'patients_medical_record_no_key',
        columns: ['medical_record_no'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'refresh_tokens',
        constraint: 'refresh_tokens_token_hash_key',
        columns: ['token_hash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'risk_assessments',
        constraint: 'risk_assessments_vital_reading_id_key',
        columns: ['vital_reading_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ai_predictions',
        index: 'ai_predictions_session_id_idx_00ba47bf',
        columns: ['session_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ai_predictions',
        index: 'ai_predictions_session_id_window_end_idx_610237d1',
        columns: ['session_id', 'window_end'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'alerts',
        index: 'alerts_acknowledged_by_idx_de4bc076',
        columns: ['acknowledged_by'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'alerts',
        index: 'alerts_session_id_idx_00ba47bf',
        columns: ['session_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'alerts',
        index: 'alerts_session_id_status_idx_f571d3b1',
        columns: ['session_id', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitoring_sessions',
        index: 'monitoring_sessions_device_id_idx_8f329912',
        columns: ['device_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitoring_sessions',
        index: 'monitoring_sessions_patient_id_idx_2f641dda',
        columns: ['patient_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitoring_sessions',
        index: 'monitoring_sessions_started_by_idx_dc9966c0',
        columns: ['started_by'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitoring_sessions',
        index: 'one_active_session_per_device_3bd1b17c',
        columns: ['device_id'],
        extras: { where: sql`(ended_at IS NULL)`, unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitoring_sessions',
        index: 'one_active_session_per_patient_7d9b9f4c',
        columns: ['patient_id'],
        extras: { where: sql`(ended_at IS NULL)`, unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'refresh_tokens',
        index: 'refresh_tokens_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vital_readings',
        index: 'vital_readings_session_id_idx_00ba47bf',
        columns: ['session_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vital_readings',
        index: 'vital_readings_session_id_recorded_at_idx_fd8ea955',
        columns: ['session_id', 'recorded_at'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ai_predictions',
        foreignKey: {
          name: 'ai_predictions_session_id_fkey',
          columns: ['session_id'],
          references: { schema: 'public', table: 'monitoring_sessions', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'alerts',
        foreignKey: {
          name: 'alerts_risk_assessment_id_fkey',
          columns: ['risk_assessment_id'],
          references: { schema: 'public', table: 'risk_assessments', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'alerts',
        foreignKey: {
          name: 'alerts_session_id_fkey',
          columns: ['session_id'],
          references: { schema: 'public', table: 'monitoring_sessions', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'alerts',
        foreignKey: {
          name: 'alerts_acknowledged_by_fkey',
          columns: ['acknowledged_by'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'monitoring_sessions',
        foreignKey: {
          name: 'monitoring_sessions_patient_id_fkey',
          columns: ['patient_id'],
          references: { schema: 'public', table: 'patients', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'monitoring_sessions',
        foreignKey: {
          name: 'monitoring_sessions_device_id_fkey',
          columns: ['device_id'],
          references: { schema: 'public', table: 'devices', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'monitoring_sessions',
        foreignKey: {
          name: 'monitoring_sessions_started_by_fkey',
          columns: ['started_by'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'refresh_tokens',
        foreignKey: {
          name: 'refresh_tokens_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'risk_assessments',
        foreignKey: {
          name: 'risk_assessments_vital_reading_id_fkey',
          columns: ['vital_reading_id'],
          references: { schema: 'public', table: 'vital_readings', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vital_readings',
        foreignKey: {
          name: 'vital_readings_session_id_fkey',
          columns: ['session_id'],
          references: { schema: 'public', table: 'monitoring_sessions', columns: ['id'] },
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'ai_predictions' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'alerts' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'devices' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'monitoring_sessions' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'patients' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'refresh_tokens' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'risk_assessments' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'users' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'vital_readings' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
