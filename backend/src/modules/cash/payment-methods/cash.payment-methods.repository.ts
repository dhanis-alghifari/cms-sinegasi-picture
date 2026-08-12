import type { SupabaseClient } from '@supabase/supabase-js';
import type { CashPaymentMethod, CashRepositoryError } from '../shared/cash.types.js';

export interface CashPaymentMethodsRepository {
  isConfigured(): boolean;
  list(includeInactive: boolean): Promise<{ data: CashPaymentMethod[]; error: CashRepositoryError }>;
  create(input: { code: string; label: string; sortOrder: number; actorId: string }): Promise<{ data: CashPaymentMethod | null; error: CashRepositoryError }>;
  findById(id: string): Promise<{ data: CashPaymentMethod | null; error: CashRepositoryError }>;
  countActive(): Promise<{ count: number; error: CashRepositoryError }>;
  update(id: string, input: { label?: string; sortOrder?: number; isActive?: boolean; actorId: string }): Promise<{ data: CashPaymentMethod | null; error: CashRepositoryError }>;
}

type SupabaseLike = SupabaseClient | null;

const METHOD_SELECT = 'id,code,label,is_active,sort_order,created_by,updated_by,created_at,updated_at';
const PAYMENT_METHODS_LIMIT_MAX = 100;

export function createCashPaymentMethodsRepository(
  client: SupabaseLike,
  memory: CashPaymentMethod[],
): CashPaymentMethodsRepository {
  return {
    isConfigured: () => client !== null,

    async list(includeInactive) {
      if (!client) {
        return {
          data: memory
            .filter((method) => includeInactive || method.is_active)
            .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
            .slice(0, PAYMENT_METHODS_LIMIT_MAX),
          error: null,
        };
      }
      let query = client.from('cash_payment_methods').select(METHOD_SELECT).order('sort_order', { ascending: true }).order('label', { ascending: true });
      if (!includeInactive) query = query.eq('is_active', true);
      query = query.limit(PAYMENT_METHODS_LIMIT_MAX);
      const { data, error } = await query;
      return { data: (data || []) as CashPaymentMethod[], error: error || null };
    },

    async create(input) {
      if (!client) {
        if (memory.some((method) => method.code === input.code)) return { data: null, error: { code: '23505', message: 'Payment method code already exists.' } };
        const now = new Date().toISOString();
        const method: CashPaymentMethod = {
          id: crypto.randomUUID(), code: input.code, label: input.label, sort_order: input.sortOrder,
          is_active: true, created_by: input.actorId, updated_by: input.actorId, created_at: now, updated_at: now,
        };
        memory.push(method);
        return { data: method, error: null };
      }
      const { data, error } = await client
        .from('cash_payment_methods')
        .insert({ code: input.code, label: input.label, sort_order: input.sortOrder, created_by: input.actorId, updated_by: input.actorId })
        .select(METHOD_SELECT)
        .single();
      return { data: (data || null) as CashPaymentMethod | null, error: error || null };
    },

    async findById(id) {
      if (!client) return { data: memory.find((method) => method.id === id) || null, error: null };
      const { data, error } = await client.from('cash_payment_methods').select(METHOD_SELECT).eq('id', id).maybeSingle();
      return { data: (data || null) as CashPaymentMethod | null, error: error || null };
    },

    async countActive() {
      if (!client) return { count: memory.filter((method) => method.is_active).length, error: null };
      const { count, error } = await client.from('cash_payment_methods').select('id', { count: 'exact', head: true }).eq('is_active', true);
      return { count: count || 0, error: error || null };
    },

    async update(id, input) {
      if (!client) {
        const method = memory.find((item) => item.id === id);
        if (!method) return { data: null, error: null };
        if (input.label !== undefined) method.label = input.label;
        if (input.sortOrder !== undefined) method.sort_order = input.sortOrder;
        if (input.isActive !== undefined) method.is_active = input.isActive;
        method.updated_by = input.actorId;
        method.updated_at = new Date().toISOString();
        return { data: method, error: null };
      }
      const payload: Record<string, unknown> = { updated_by: input.actorId, updated_at: new Date().toISOString() };
      if (input.label !== undefined) payload.label = input.label;
      if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;
      if (input.isActive !== undefined) payload.is_active = input.isActive;
      const { data, error } = await client.from('cash_payment_methods').update(payload).eq('id', id).select(METHOD_SELECT).single();
      return { data: (data || null) as CashPaymentMethod | null, error: error || null };
    },
  };
}
