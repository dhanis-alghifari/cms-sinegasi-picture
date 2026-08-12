import {
  CAPABILITY_VALUES,
  getCapabilities,
  setRoleCapabilities,
  type Capability,
} from '../../middleware/capabilities.js';
import { USER_ROLE_VALUES, type JwtPayload, type UserRole } from '../../shared/auth/auth.types.js';
import type { AccessControlRepository } from './access-control.types.js';

export class AccessControlServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) {
    super(message);
    this.name = 'AccessControlServiceError';
  }
}

function isRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLE_VALUES.includes(value as UserRole);
}

function isCapability(value: unknown): value is Capability {
  return typeof value === 'string' && CAPABILITY_VALUES.includes(value as Capability);
}

export class AccessControlService {
  constructor(private readonly repository: AccessControlRepository) {}

  async getMatrix() {
    const result = await this.repository.getMatrix();
    if ('error' in result) throw new AccessControlServiceError(503, 'ACCESS_CONTROL_UNAVAILABLE', 'Policy akses belum tersedia. Jalankan migration access control terlebih dahulu.');
    return result.data;
  }

  async listAuditLogs(limit = 100) {
    const result = await this.repository.listAuditLogs(limit);
    if ('error' in result) throw new AccessControlServiceError(503, 'ACCESS_CONTROL_AUDIT_UNAVAILABLE', 'Riwayat perubahan akses belum tersedia. Jalankan migration access control terlebih dahulu.');
    return result.data;
  }

  async updateRoleCapabilities(actor: JwtPayload, roleInput: unknown, capabilitiesInput: unknown, reasonInput: unknown, actorUserId: string | null) {
    if (actor.role !== 'teacher') throw new AccessControlServiceError(403, 'ACCESS_CONTROL_FORBIDDEN', 'Hanya guru yang dapat mengubah pengaturan akses.');
    if (!isRole(roleInput)) throw new AccessControlServiceError(422, 'INVALID_ROLE', 'Role tujuan tidak valid.');
    if (!Array.isArray(capabilitiesInput)) throw new AccessControlServiceError(422, 'INVALID_CAPABILITIES', 'Capabilities harus berupa array.');
    const capabilities = [...new Set(capabilitiesInput)];
    if (!capabilities.every(isCapability)) throw new AccessControlServiceError(422, 'INVALID_CAPABILITIES', 'Terdapat capability yang tidak dikenal.');
    if (typeof reasonInput !== 'string' || reasonInput.trim().length < 5 || reasonInput.trim().length > 500) {
      throw new AccessControlServiceError(422, 'INVALID_CHANGE_REASON', 'Alasan perubahan minimal 5 dan maksimal 500 karakter.');
    }
    if (roleInput === 'teacher' && !capabilities.includes('access_control.manage')) {
      throw new AccessControlServiceError(422, 'TEACHER_LOCKOUT', 'Capability access_control.manage wajib tetap aktif untuk guru.');
    }

    const previous = await this.repository.getRoleCapabilities(roleInput);
    if ('error' in previous) throw new AccessControlServiceError(503, 'ACCESS_CONTROL_UNAVAILABLE', 'Policy akses belum tersedia. Jalankan migration access control terlebih dahulu.');
    const result = await this.repository.replaceRoleCapabilities({
      role: roleInput,
      capabilities,
      actorUserId,
      changeReason: reasonInput.trim(),
    });
    if ('error' in result) throw new AccessControlServiceError(503, 'ACCESS_CONTROL_PERSIST_FAILED', 'Perubahan policy gagal disimpan.');
    setRoleCapabilities(roleInput, capabilities);
    return { role: roleInput, previous: previous.data, capabilities: getCapabilities(roleInput) };
  }
}
