import { useMemo, useState } from 'react';
import { AlertCircle, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { PageHeader } from '@/shared/ui/PageHeader';
import { PanelSkeleton } from '@/shared/ui/LoadingSkeletons';
import { useAccessControlMatrixQuery, useUpdateRoleCapabilitiesMutation } from '../hooks/useAccessControlQuery';
import { CAPABILITY_VALUES, type Capability } from '@/shared/auth/capabilities';
import { formatRoleLabel } from '@/shared/utils/formatLabels';
import type { UserRole } from '@/shared/types/common';

const permissionLabels: Partial<Record<Capability, string>> = {};
for (const permission of CAPABILITY_VALUES) {
  permissionLabels[permission] = permission.replaceAll('.', ' › ');
}

export function AccessControlPage() {
  const { data, isLoading, error } = useAccessControlMatrixQuery();
  const mutation = useUpdateRoleCapabilitiesMutation();
  const [drafts, setDrafts] = useState<Partial<Record<UserRole, Capability[]>>>({});
  const [reasons, setReasons] = useState<Partial<Record<UserRole, string>>>({});

  const permissions = useMemo(() => data?.permissions ?? CAPABILITY_VALUES, [data]);
  const serverDrafts = useMemo<Partial<Record<UserRole, Capability[]>>>(() => {
    const roleCapabilities: Partial<Record<UserRole, Capability[]>> = {};
    for (const role of data?.roles ?? []) {
      roleCapabilities[role.role] = role.capabilities;
    }
    return roleCapabilities;
  }, [data]);

  if (isLoading) return <PanelSkeleton rows={5} label="Memuat matriks akses..." />;
  if (!data) {
    return <div className="mx-auto max-w-4xl p-6" role="alert"><div className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 p-4 text-sm text-semantic-danger"><AlertCircle className="mr-2 inline size-4" />{error instanceof Error ? error.message : 'Policy akses belum dapat dimuat.'}</div></div>;
  }

  return (
    <div className="space-y-5 px-4 py-5 sm:p-6">
      <PageHeader title="Pengaturan Akses" subtitle="Atur modul yang tersedia untuk setiap role. Perubahan hanya dapat dilakukan guru dan tercatat sebagai audit." />
      <div className="grid gap-5 xl:grid-cols-2">
        {data.roles.map(({ role }) => {
          const selected = drafts[role] ?? serverDrafts[role] ?? [];
          const changeReason = (reasons[role] ?? '').trim();
          const hasValidChangeReason = changeReason.length >= 5 && changeReason.length <= 500;
          return (
            <Card key={role} className="bg-surface-1">
              <CardHeader className="flex-row items-center justify-between border-b border-hairline">
                <CardTitle className="flex items-center gap-2 text-ink"><ShieldCheck className="size-4 text-primary" />{formatRoleLabel(role, role)}</CardTitle>
                <Button
                  size="sm"
                  disabled={mutation.isPending || !hasValidChangeReason || (role === 'teacher' && !selected.includes('access_control.manage'))}
                  onClick={() => mutation.mutate({ role, input: { capabilities: selected, change_reason: changeReason } })}
                >
                  <Save className="mr-1.5 size-3.5" />Simpan
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <label className="block text-xs font-medium text-ink-subtle" htmlFor={`reason-${role}`}>Alasan perubahan</label>
                <input
                  id={`reason-${role}`}
                  type="text"
                  value={reasons[role] ?? ''}
                  onChange={(event) => setReasons((current) => ({ ...current, [role]: event.target.value }))}
                  placeholder="Contoh: pembagian tugas semester baru"
                  required
                  minLength={5}
                  maxLength={500}
                  aria-describedby={`reason-hint-${role}`}
                  className="h-9 w-full rounded-md border border-hairline bg-surface-2 px-3 text-xs text-ink outline-none focus:border-primary"
                />
                <p id={`reason-hint-${role}`} className="text-xs text-ink-tertiary">
                  Wajib diisi 5–500 karakter; alasan ini akan dicatat di riwayat perubahan.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {permissions.map((permission) => {
                    const checked = selected.includes(permission);
                    return (
                      <label key={permission} className="flex items-center gap-2 rounded-md border border-hairline px-2.5 py-2 text-xs text-ink-subtle hover:bg-surface-2">
                        <Checkbox checked={checked} onChange={() => setDrafts((current) => ({ ...current, [role]: checked ? selected.filter((item) => item !== permission) : [...selected, permission] }))} aria-label={permissionLabels[permission] ?? permission} />
                        <span>{permissionLabels[permission] ?? permission}</span>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
