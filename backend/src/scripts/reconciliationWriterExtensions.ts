import { sha256 } from './productionReconciliation.js';
import { WriterError } from './reconciliationWriterPolicy.js';
import type { WriterSession } from './reconciliationWriterCatalog.js';

// PostgreSQL 17 pg_trgm 1.6 native functions only. Never exempt arbitrary
// extension members: ALTER EXTENSION ADD can attach an application RPC.
const SIGNATURES = [
  'gin_extract_query_trgm(text,internal,smallint,internal,internal,internal,internal)',
  'gin_extract_value_trgm(text,internal)',
  'gin_trgm_consistent(internal,smallint,text,integer,internal,internal,internal,internal)',
  'gin_trgm_triconsistent(internal,smallint,text,integer,internal,internal,internal)',
  'gtrgm_compress(internal)', 'gtrgm_consistent(internal,text,smallint,oid,internal)',
  'gtrgm_decompress(internal)', 'gtrgm_distance(internal,text,smallint,oid,internal)',
  'gtrgm_in(cstring)', 'gtrgm_options(internal)', 'gtrgm_out(gtrgm)',
  'gtrgm_penalty(internal,internal,internal)', 'gtrgm_picksplit(internal,internal)',
  'gtrgm_same(gtrgm,gtrgm,internal)', 'gtrgm_union(internal,internal)',
  'set_limit(real)', 'show_limit()', 'show_trgm(text)', 'similarity(text,text)',
  'similarity_dist(text,text)', 'similarity_op(text,text)',
  'strict_word_similarity(text,text)', 'strict_word_similarity_commutator_op(text,text)',
  'strict_word_similarity_dist_commutator_op(text,text)', 'strict_word_similarity_dist_op(text,text)',
  'strict_word_similarity_op(text,text)', 'word_similarity(text,text)',
  'word_similarity_commutator_op(text,text)', 'word_similarity_dist_commutator_op(text,text)',
  'word_similarity_dist_op(text,text)', 'word_similarity_op(text,text)',
] as const;

export interface ManagedTrigram { sha256: string; signatures: string[] }
export function validateManagedTrigram(rows: readonly Record<string, unknown>[]): ManagedTrigram {
  if (rows.length && (rows.length !== SIGNATURES.length || new Set(rows.map(r => r.signature)).size !== SIGNATURES.length
    || rows.some(r => !SIGNATURES.some(signature => signature === r.signature)
      || r.extension !== 'pg_trgm' || r.version !== '1.6' || r.schema !== 'public'
      || r.extensionOwner !== 'supabase_admin' || r.owner !== 'supabase_admin'
      || r.language !== 'c' || r.binary !== '$libdir/pg_trgm' || r.definer !== false || r.kind !== 'f'
      || r.source !== String(r.signature).split('(')[0] || r.grantable !== false || r.config !== null))) {
    throw new WriterError('UNREVIEWED_MANAGED_EXTENSION_REFUSED');
  }
  return { sha256: sha256(JSON.stringify(rows)), signatures: rows.map(r => String(r.signature)) };
}

/** Read-only. Keep ACL, native entry point, result type and execution attributes
 * bound to operator review, and unchanged across schema writes. OIDs excluded.
 */
export async function readManagedTrigram(db: WriterSession): Promise<ManagedTrigram> {
  const rows = (await db.query(`SELECT p.oid::regprocedure::text AS signature,e.extname AS extension,e.extversion AS version,
    en.nspname AS schema,pg_get_userbyid(e.extowner) AS "extensionOwner",pg_get_userbyid(p.proowner) AS owner,
    l.lanname AS language,p.probin AS binary,p.prosrc AS source,p.prosecdef AS definer,p.prokind AS kind,
    p.proconfig AS config,
    (SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),
      CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable)
      ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
      FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a) AS acl,
    pg_get_function_result(p.oid) AS result,
    p.provolatile AS volatility,p.proisstrict AS strict,p.proleakproof AS leakproof,p.proparallel AS parallel,
    has_function_privilege(current_user,p.oid,'EXECUTE WITH GRANT OPTION') AS grantable,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_extension'::regclass AND d.deptype='e'
    JOIN pg_extension e ON e.oid=d.refobjid JOIN pg_namespace en ON en.oid=e.extnamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND pg_get_userbyid(p.proowner)<>current_user
    ORDER BY p.oid::regprocedure::text COLLATE "C"`)).rows;
  return validateManagedTrigram(rows);
}
