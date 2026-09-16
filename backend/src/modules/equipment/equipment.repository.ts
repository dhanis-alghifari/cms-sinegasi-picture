import crypto from 'node:crypto';
import {
  EQUIPMENT_SELECT,
  EQUIPMENT_REPORT_MAX_ITEMS,
  equipmentDbPayload,
  mapEquipmentRow,
  parseEquipmentPagination,
  sanitizeEquipmentSearch,
  textValue,
} from './equipment.helpers.js';
import type {
  EquipmentConditionInput,
  EquipmentCreateInput,
  EquipmentDeleteInput,
  EquipmentDatabaseError,
  EquipmentEntry,
  EquipmentListQuery,
  EquipmentMemoryState,
  EquipmentRepository,
  EquipmentReportQuery,
  EquipmentSummary,
  EquipmentSupabaseClient,
  EquipmentUpdateInput,
  EquipmentValuation,
  EquipmentValuationInput,
} from './equipment.types.js';

const ACTIVE_BORROWING_STATUSES = ['pending', 'approved', 'borrowed'];
const ACTIVE_RESERVATION_LOOKUP_LIMIT = 5_000;

const EQUIPMENT_REPORT_SELECT = EQUIPMENT_SELECT
  .split(',')
  .filter((field) => field !== 'fotos' && field !== 'foto_url')
  .join(',');
const EQUIPMENT_VALUATION_HISTORY_LIMIT = 100;
const EQUIPMENT_VALUATION_LOOKUP_LIMIT = 10_000;

function databaseError(error: unknown): EquipmentDatabaseError | null {
  if (!error) return null;
  const value = error as EquipmentDatabaseError;
  return { code: value.code, message: value.message, details: value.details, hint: value.hint };
}

function firstRpcRow(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? row as Record<string, unknown> : null;
}

function scalarRpcId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

function isMissingSchemaError(error: EquipmentDatabaseError | null): boolean {
  return Boolean(error && ['42P01', '42703', 'PGRST205'].includes(error.code || ''));
}

function countMemorySummary(equipment: EquipmentEntry[]): EquipmentSummary {
  return {
    totalAlat: equipment.length,
    tersedia: equipment.filter((item) => item.status === 'tersedia').length,
    dipinjam: equipment.filter((item) => item.status === 'dipinjam').length,
    maintenance: equipment.filter((item) => item.status === 'maintenance').length,
    rusak: equipment.filter((item) => ['sedikit_kerusakan', 'rusak', 'rusak_besar'].includes(item.kondisi)).length,
    hilang: equipment.filter((item) => item.kondisi === 'hilang' || item.asset_state === 'lost').length,
  };
}

function matchesFilter(value: string | undefined, filter: string | undefined): boolean {
  return !filter || filter === 'all' || value?.toLowerCase() === filter.toLowerCase();
}

function findMemoryEquipment(state: EquipmentMemoryState, id: string): EquipmentEntry | undefined {
  return state.equipment.find((item) => item.id === id);
}

function mapValuationRow(row: Record<string, unknown>): EquipmentValuation {
  return {
    id: textValue(row.id),
    equipment_id: textValue(row.equipment_id),
    replacement_value: Number(row.replacement_value),
    currency: textValue(row.currency, 'IDR'),
    effective_at: textValue(row.effective_at),
    source_url: textValue(row.source_url) || undefined,
    notes: textValue(row.notes) || undefined,
    created_by: textValue(row.created_by) || undefined,
    change_reason: textValue(row.change_reason),
    created_at: textValue(row.created_at),
  };
}

export function createEquipmentRepository(client: EquipmentSupabaseClient, state: EquipmentMemoryState): EquipmentRepository {
  return {
    isConfigured: () => client !== null,

    async list(query: EquipmentListQuery) {
      const { page, pageSize, from, to } = parseEquipmentPagination(query.page, query.pageSize);
      const search = query.search ? sanitizeEquipmentSearch(query.search) : '';

      if (!client) {
        const rows = state.equipment
          .filter((item) => {
            const matchesSearch = !search
              || `${item.nama_alat} ${item.kode_alat}`.toLowerCase().includes(search.toLowerCase());
            return matchesSearch
              && matchesFilter(item.kategori, query.kategori)
              && matchesFilter(item.kondisi, query.kondisi)
              && matchesFilter(item.status, query.status);
          })
          .sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id));
        return {
          data: rows.slice(from, to + 1),
          count: rows.length,
          error: null,
        };
      }

      let dbQuery = client.from('equipment').select(EQUIPMENT_SELECT, { count: 'exact' });
      if (search) dbQuery = dbQuery.or(`nama_alat.ilike.%${search}%,kode_alat.ilike.%${search}%`);
      if (query.kategori && query.kategori !== 'all') dbQuery = dbQuery.eq('kategori', query.kategori);
      if (query.kondisi && query.kondisi !== 'all') dbQuery = dbQuery.eq('kondisi', query.kondisi);
      if (query.status && query.status !== 'all') dbQuery = dbQuery.eq('status', query.status);

      const result = await dbQuery
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      const resultError = databaseError(result.error);
      if (resultError) return { data: [], count: 0, error: resultError };

      const rows = (result.data || []) as unknown as Record<string, unknown>[];
      const equipmentIds = rows.map((row) => textValue(row.id)).filter(Boolean);
      const reservedIds = new Set<string>();
      if (equipmentIds.length > 0) {
        const reservations = await client
          .from('borrowing_items')
          .select('equipment_id')
          .in('equipment_id', equipmentIds)
          .in('status', ACTIVE_BORROWING_STATUSES)
          .limit(ACTIVE_RESERVATION_LOOKUP_LIMIT);
        const reservationError = databaseError(reservations.error);
        if (reservationError && !isMissingSchemaError(reservationError)) {
          return { data: [], count: 0, error: reservationError };
        }
        for (const reservation of (reservations.data || []) as Array<Record<string, unknown>>) {
          const id = textValue(reservation.equipment_id);
          if (id) reservedIds.add(id);
        }
      }

      const valuations = equipmentIds.length > 0
        ? await client.from('equipment_valuations').select('id,equipment_id,replacement_value,currency,effective_at,created_at').in('equipment_id', equipmentIds).order('effective_at', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(Math.min(EQUIPMENT_VALUATION_LOOKUP_LIMIT, equipmentIds.length * 10))
        : { data: [], error: null };
      const valuationError = databaseError(valuations.error);
      if (valuationError && !isMissingSchemaError(valuationError)) return { data: [], count: 0, error: valuationError };
      const latestValuation = new Map<string, Record<string, unknown>>();
      for (const valuation of (valuations.data || []) as Array<Record<string, unknown>>) {
        const equipmentId = textValue(valuation.equipment_id);
        if (equipmentId && !latestValuation.has(equipmentId)) latestValuation.set(equipmentId, valuation);
      }
      return {
        data: rows.map((row) => mapEquipmentRow({ ...row, ...(latestValuation.get(textValue(row.id)) ? {
          replacement_value: latestValuation.get(textValue(row.id))?.replacement_value,
          replacement_value_currency: latestValuation.get(textValue(row.id))?.currency,
          replacement_value_effective_at: latestValuation.get(textValue(row.id))?.effective_at,
        } : {}) }, reservedIds.has(textValue(row.id)))),
        count: Number(result.count || 0),
        error: null,
      };
    },

    async report(query: EquipmentReportQuery) {
      const search = query.search ? sanitizeEquipmentSearch(query.search) : '';
      const includePhotos = query.includePhotos === true;
      const includeValuation = query.includeValuation === true;
      const select = includePhotos ? EQUIPMENT_SELECT : EQUIPMENT_REPORT_SELECT;

      if (!client) {
        const rows = state.equipment
          .filter((item) => {
            const matchesSearch = !search
              || `${item.nama_alat} ${item.kode_alat}`.toLowerCase().includes(search.toLowerCase());
            return matchesSearch
              && matchesFilter(item.kategori, query.kategori)
              && matchesFilter(item.kondisi, query.kondisi)
              && matchesFilter(item.status, query.status);
          })
          .sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id));
        if (rows.length > EQUIPMENT_REPORT_MAX_ITEMS) {
          return { data: [], count: rows.length, error: { code: 'REPORT_TOO_LARGE', message: `Report exceeds ${EQUIPMENT_REPORT_MAX_ITEMS} items.` } };
        }
        return { data: rows.map((item) => ({ ...item, ...(includePhotos ? {} : { foto_urls: undefined, foto_url: undefined }), ...(includeValuation ? {} : { replacement_value: undefined, replacement_value_currency: undefined, replacement_value_effective_at: undefined }) })), count: rows.length, error: null };
      }

      let dbQuery = client.from('equipment').select(select, { count: 'exact' });
      if (search) dbQuery = dbQuery.or(`nama_alat.ilike.%${search}%,kode_alat.ilike.%${search}%`);
      if (query.kategori && query.kategori !== 'all') dbQuery = dbQuery.eq('kategori', query.kategori);
      if (query.kondisi && query.kondisi !== 'all') dbQuery = dbQuery.eq('kondisi', query.kondisi);
      if (query.status && query.status !== 'all') dbQuery = dbQuery.eq('status', query.status);

      const result = await dbQuery
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(0, EQUIPMENT_REPORT_MAX_ITEMS - 1);
      const resultError = databaseError(result.error);
      if (resultError) return { data: [], count: 0, error: resultError };
      const count = Number(result.count || 0);
      if (count > EQUIPMENT_REPORT_MAX_ITEMS) {
        return { data: [], count, error: { code: 'REPORT_TOO_LARGE', message: `Report exceeds ${EQUIPMENT_REPORT_MAX_ITEMS} items.` } };
      }

      const rows = (result.data || []) as unknown as Record<string, unknown>[];
      const equipmentIds = rows.map((row) => textValue(row.id)).filter(Boolean);
      const reservedIds = new Set<string>();
      if (equipmentIds.length > 0) {
        const reservations = await client
          .from('borrowing_items')
          .select('equipment_id')
          .in('equipment_id', equipmentIds)
          .in('status', ACTIVE_BORROWING_STATUSES)
          .limit(ACTIVE_RESERVATION_LOOKUP_LIMIT);
        const reservationError = databaseError(reservations.error);
        if (reservationError && !isMissingSchemaError(reservationError)) return { data: [], count: 0, error: reservationError };
        for (const reservation of (reservations.data || []) as Array<Record<string, unknown>>) {
          const id = textValue(reservation.equipment_id);
          if (id) reservedIds.add(id);
        }
      }

      const valuations = includeValuation && equipmentIds.length > 0
        ? await client.from('equipment_valuations').select('id,equipment_id,replacement_value,currency,effective_at,created_at').in('equipment_id', equipmentIds).order('effective_at', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(Math.min(EQUIPMENT_VALUATION_LOOKUP_LIMIT, equipmentIds.length * 10))
        : { data: [], error: null };
      const valuationError = databaseError(valuations.error);
      if (valuationError && !isMissingSchemaError(valuationError)) return { data: [], count: 0, error: valuationError };
      const latestValuation = new Map<string, Record<string, unknown>>();
      for (const valuation of (valuations.data || []) as Array<Record<string, unknown>>) {
        const equipmentId = textValue(valuation.equipment_id);
        if (equipmentId && !latestValuation.has(equipmentId)) latestValuation.set(equipmentId, valuation);
      }

      return {
        data: rows.map((row) => mapEquipmentRow({
          ...row,
          ...(latestValuation.get(textValue(row.id)) ? {
            replacement_value: latestValuation.get(textValue(row.id))?.replacement_value,
            replacement_value_currency: latestValuation.get(textValue(row.id))?.currency,
            replacement_value_effective_at: latestValuation.get(textValue(row.id))?.effective_at,
          } : {}),
        }, reservedIds.has(textValue(row.id)))),
        count,
        error: null,
      };
    },

    async summary() {
      if (!client) return { data: countMemorySummary(state.equipment), error: null };

      const [total, tersedia, dipinjam, maintenance, rusak, hilang] = await Promise.all([
        client.from('equipment').select('id', { count: 'exact', head: true }),
        client.from('equipment').select('id', { count: 'exact', head: true }).eq('status', 'tersedia'),
        client.from('equipment').select('id', { count: 'exact', head: true }).eq('status', 'dipinjam'),
        client.from('equipment').select('id', { count: 'exact', head: true }).eq('status', 'maintenance'),
        client.from('equipment').select('id', { count: 'exact', head: true }).in('kondisi', ['sedikit_kerusakan', 'rusak', 'rusak_besar']),
        client.from('equipment').select('id', { count: 'exact', head: true }).or('kondisi.eq.hilang,asset_state.eq.lost'),
      ]);
      const failed = [total, tersedia, dipinjam, maintenance, rusak, hilang]
        .map((result) => databaseError(result.error))
        .find((error) => error);
      if (failed) return { data: null, error: failed };
      return {
        data: {
          totalAlat: total.count || 0,
          tersedia: tersedia.count || 0,
          dipinjam: dipinjam.count || 0,
          maintenance: maintenance.count || 0,
          rusak: rusak.count || 0,
          hilang: hilang.count || 0,
        },
        error: null,
      };
    },

    async findById(id: string) {
      if (!client) {
        const item = findMemoryEquipment(state, id);
        return { data: item ? { ...item } : null, error: null };
      }

      const result = await client.from('equipment').select(EQUIPMENT_SELECT).eq('id', id).maybeSingle();
      const resultError = databaseError(result.error);
      if (resultError) return { data: null, error: resultError };
      if (!result.data) return { data: null, error: null };
      const reservation = await client
        .from('borrowing_items')
        .select('id')
        .eq('equipment_id', id)
        .in('status', ACTIVE_BORROWING_STATUSES)
        .limit(1)
        .maybeSingle();
      const reservationError = databaseError(reservation.error);
      if (reservationError && !isMissingSchemaError(reservationError)) return { data: null, error: reservationError };
      return { data: mapEquipmentRow(result.data as unknown as Record<string, unknown>, Boolean(reservation.data)), error: null };
    },

    async create(input: EquipmentCreateInput) {
      if (!client) {
        const record: EquipmentEntry = {
          id: `eq-${Date.now()}`,
          kode_alat: input.kodeAlat,
          nama_alat: input.namaAlat,
          kategori: input.kategori,
          kondisi: input.kondisi,
          status: input.status,
          lokasi_penyimpanan: input.lokasiPenyimpanan,
          serial_number: input.serialNumber,
          foto_urls: input.fotoUrls,
          foto_url: input.fotoUrls[0],
          deskripsi: input.deskripsi,
          created_by: input.actorId,
          created_at: new Date().toISOString(),
        };
        state.equipment.unshift(record);
        return { data: record, error: null };
      }

      const result = await client.from('equipment').insert({
        ...equipmentDbPayload({
          kode_alat: input.kodeAlat,
          nama_alat: input.namaAlat,
          kategori: input.kategori,
          kondisi: input.kondisi,
          status: input.status,
          lokasi_penyimpanan: input.lokasiPenyimpanan,
          serial_number: input.serialNumber,
          foto_urls: input.fotoUrls,
          deskripsi: input.deskripsi,
        }),
        created_by: input.actorId,
      }).select(EQUIPMENT_SELECT).single();
      const resultError = databaseError(result.error);
      if (resultError) return { data: null, error: resultError };
      return { data: mapEquipmentRow(result.data as unknown as Record<string, unknown>), error: null };
    },

    async update(input: EquipmentUpdateInput) {
      if (!client) {
        let index = state.equipment.findIndex((item) => item.id === input.id);
        if (index < 0 && input.changes.kode_alat) {
          index = state.equipment.findIndex((item) => item.kode_alat === input.changes.kode_alat);
        }
        if (index < 0) return { data: null, error: { code: 'NOT_FOUND', message: 'Alat tidak ditemukan.' } };
        state.equipment[index] = {
          ...state.equipment[index],
          ...input.changes,
          ...(input.changes.foto_urls ? { foto_url: input.changes.foto_urls[0] } : {}),
          updated_by: input.actorId,
          updated_at: new Date().toISOString(),
        };
        return { data: { ...state.equipment[index] }, error: null };
      }

      const result = await client.rpc('update_equipment_atomic', {
        p_equipment_id: input.id,
        p_changes: input.changes,
        p_updated_by: input.actorId,
        p_change_reason: input.changeReason,
      });
      const resultError = databaseError(result.error);
      if (resultError) return { data: null, error: resultError };
      const row = firstRpcRow(result.data);
      return { data: row ? mapEquipmentRow(row) : null, error: null };
    },

    async updateCondition(input: EquipmentConditionInput) {
      if (!client) {
        const item = findMemoryEquipment(state, input.id);
        if (!item) return { data: null, error: { code: 'NOT_FOUND', message: 'Alat tidak ditemukan.' } };
        item.kondisi = input.kondisi;
        if (input.status) item.status = input.status;
        if (input.catatanKerusakan !== undefined) item.catatan_kerusakan = input.catatanKerusakan || undefined;
        item.updated_by = input.actorId;
        item.updated_at = new Date().toISOString();
        return { data: { ...item }, error: null };
      }

      const result = await client.rpc('update_equipment_condition_atomic', {
        p_equipment_id: input.id,
        p_kondisi: input.kondisi,
        p_updated_by: input.actorId,
        p_change_reason: input.changeReason,
        ...(input.status === undefined ? {} : { p_status: input.status }),
        ...(input.catatanKerusakan === undefined ? {} : { p_catatan_kerusakan: input.catatanKerusakan }),
      });
      const resultError = databaseError(result.error);
      if (resultError) return { data: null, error: resultError };
      const row = firstRpcRow(result.data);
      return { data: row ? mapEquipmentRow(row) : null, error: null };
    },

    async remove(input: EquipmentDeleteInput) {
      if (!client) {
        const index = state.equipment.findIndex((item) => item.id === input.id);
        if (index < 0) return { deletedId: null, error: { code: 'NOT_FOUND', message: 'Alat tidak ditemukan.' } };
        state.equipment.splice(index, 1);
        return { deletedId: input.id, error: null };
      }

      const result = await client.rpc('delete_equipment_atomic', {
        p_equipment_id: input.id,
        p_deleted_by: input.actorId,
        p_change_reason: input.changeReason,
      });
      const resultError = databaseError(result.error);
      if (resultError) return { deletedId: null, error: resultError };
      const deletedId = scalarRpcId(result.data);
      return { deletedId: deletedId || null, error: null };
    },

    async listValuations(equipmentId: string) {
      if (!client) {
        const item = findMemoryEquipment(state, equipmentId);
        if (!item || item.replacement_value === undefined) return { data: [], error: null };
        return { data: [{ id: `valuation-${equipmentId}`, equipment_id: equipmentId, replacement_value: item.replacement_value, currency: item.replacement_value_currency || 'IDR', effective_at: item.replacement_value_effective_at || item.updated_at || item.created_at, change_reason: 'Memory adapter valuation', created_at: item.updated_at || item.created_at }], error: null };
      }
      const result = await client.from('equipment_valuations').select('id,equipment_id,replacement_value,currency,effective_at,source_url,notes,created_by,change_reason,created_at').eq('equipment_id', equipmentId).order('effective_at', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(EQUIPMENT_VALUATION_HISTORY_LIMIT);
      return { data: (result.data || []).map((row) => mapValuationRow(row as Record<string, unknown>)), error: databaseError(result.error) };
    },

    async createValuation(input: EquipmentValuationInput) {
      if (!client) {
        const item = findMemoryEquipment(state, input.equipmentId);
        if (!item) return { data: null, error: { code: 'NOT_FOUND', message: 'Alat tidak ditemukan.' } };
        const now = new Date().toISOString();
        item.replacement_value = input.replacementValue;
        item.replacement_value_currency = input.currency;
        item.replacement_value_effective_at = input.effectiveAt || now;
        item.updated_by = input.actorId;
        item.updated_at = now;
        return { data: { id: `valuation-${crypto.randomUUID()}`, equipment_id: input.equipmentId, replacement_value: input.replacementValue, currency: input.currency, effective_at: input.effectiveAt || now, source_url: input.sourceUrl, notes: input.notes, created_by: input.actorId, change_reason: input.changeReason, created_at: now }, error: null };
      }
      const result = await client.from('equipment_valuations').insert({
        equipment_id: input.equipmentId,
        replacement_value: input.replacementValue,
        currency: input.currency,
        effective_at: input.effectiveAt || new Date().toISOString(),
        source_url: input.sourceUrl,
        notes: input.notes,
        created_by: input.actorId,
        change_reason: input.changeReason,
      }).select('id,equipment_id,replacement_value,currency,effective_at,source_url,notes,created_by,change_reason,created_at').single();
      return { data: result.data ? mapValuationRow(result.data as Record<string, unknown>) : null, error: databaseError(result.error) };
    },
  };
}
