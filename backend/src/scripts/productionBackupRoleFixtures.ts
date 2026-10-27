/** Synthetic metadata for isolated tests only; never operational approval. */
export function backupRoleFixture(): Record<string, unknown> {
  return { rolname: 'sinegasi_backup', rolsuper: false, rolinherit: true, rolcreaterole: false,
    rolcreatedb: false, rolcanlogin: true, rolreplication: false, rolbypassrls: true,
    rolconnlimit: 1, rolconfig: ['default_transaction_read_only=on'], no_expiry: true };
}
export function backupMembershipFixture(): Record<string, unknown>[] {
  return [
    { role_name: 'pg_read_all_data', member_name: 'sinegasi_backup', grantor_name: 'postgres', admin_option: false, inherit_option: true, set_option: true },
    { role_name: 'sinegasi_backup', member_name: 'postgres', grantor_name: 'supabase_admin', admin_option: true, inherit_option: false, set_option: false },
  ];
}
export function backupSecurityFixture(): Record<string, unknown>[] {
  return backupMembershipFixture().map(row => ({ kind: 'membership', name: `${row.role_name}:${row.member_name}`,
    metadata: JSON.stringify({ set: row.set_option, admin: row.admin_option, inherit: row.inherit_option }) }));
}
