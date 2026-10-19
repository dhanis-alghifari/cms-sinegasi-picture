/** Synthetic metadata ONLY for offline tests, never a provider receipt or approval. */
export function photoMetadata(sql: string): Record<string, unknown> {
  return { body: /AS \$\$([\s\S]*?)\$\$;/.exec(sql)?.[1], definer: false, config: ['search_path=""'],
    owner: 'postgres', language: 'plpgsql', kind: 'f', volatility: 'v', strict: false, leakproof: false,
    parallel: 'u', returns_set: false, result: 'jsonb', defaults: 0, cost: 100, result_rows: 0,
    support: '-', binary: null, sql_body: null, variadic: 0, transforms: null, extension_owned: false,
    argument_names: ['p_student_id', 'p_nama', 'p_kelas', 'p_peminatan', 'p_no_telepon', 'p_foto_url', 'p_updated_by', 'p_change_reason'],
    argument_modes: null, overloads: 1, anon_execute: false, authenticated_execute: false, service_execute: true,
    acl: ['postgres', 'service_role'].map(grantee => ({ grantee, grantor: 'postgres', privilege: 'EXECUTE', grantable: false })) };
}
