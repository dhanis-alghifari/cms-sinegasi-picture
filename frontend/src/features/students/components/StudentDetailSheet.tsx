import { KeyRound, Link2, Pencil, Phone, UserCheck, UserRound, UserX } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/primitives/sheet';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import type { Student } from '../types/students.types';

interface StudentDetailSheetProps {
  dialog: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
  student: Student | null;
  viewport: {
    isMobile: boolean;
  };
  permissions?: {
    canManage?: boolean;
    canManageStatus?: boolean;
  };
  actions: {
    onEdit: (student: Student) => void;
    onToggleActive: (student: Student) => void;
    onProvisionAccount?: (student: Student) => void;
    onLinkLegacyAccount?: (student: Student) => void;
  };
}

export function StudentDetailSheet({
  dialog,
  student,
  viewport,
  permissions,
  actions,
}: StudentDetailSheetProps) {
  const { open, onOpenChange } = dialog;
  const { isMobile } = viewport;
  const { canManage = true, canManageStatus = false } = permissions ?? {};
  const { onEdit, onToggleActive, onProvisionAccount, onLinkLegacyAccount } = actions;
  if (!student) return null;

  const handleEdit = () => {
    onOpenChange(false);
    onEdit(student);
  };

  const handleProvisionAccount = () => {
    onOpenChange(false);
    onProvisionAccount?.(student);
  };

  const handleLinkLegacyAccount = () => {
    onOpenChange(false);
    onLinkLegacyAccount?.(student);
  };

  const handleToggleActive = () => {
    onOpenChange(false);
    onToggleActive(student);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? 'bottom' : 'right'} className={isMobile ? 'max-h-[88dvh] rounded-t-2xl border-hairline bg-surface-1 pb-[calc(1rem+env(safe-area-inset-bottom))]' : 'border-hairline bg-surface-1 sm:max-w-md'}>
        <SheetHeader className="border-b border-hairline px-4 pb-4">
          <SheetTitle className="flex items-center gap-2 text-ink">
            <UserRound size={18} className="text-primary" aria-hidden="true" />
            Detail siswa
          </SheetTitle>
          <SheetDescription className="text-ink-subtle">Informasi profil dan status akun siswa.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
          <div className="flex items-center gap-3">
            {student.foto_url ? <img src={student.foto_url} alt="" className="h-16 w-16 rounded-2xl border border-hairline object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-hairline bg-surface-3 text-2xl font-semibold uppercase text-ink-subtle">{student.nama.charAt(0)}</div>}
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-ink">{student.nama}</h3>
              <p className="font-mono text-sm text-ink-subtle">{student.nis}</p>
              <div className="mt-2"><StatusBadge label={student.is_active ? 'Aktif' : 'Alumni / Nonaktif'} variant={student.is_active ? 'success' : 'neutral'} /></div>
            </div>
          </div>

          <dl className="divide-y divide-hairline rounded-xl border border-hairline bg-surface-2">
            <div className="flex items-start justify-between gap-4 px-3 py-3"><dt className="text-xs text-ink-tertiary">Kelas</dt><dd className="text-right text-sm text-ink">{student.kelas}</dd></div>
            <div className="flex items-start justify-between gap-4 px-3 py-3"><dt className="text-xs text-ink-tertiary">Peminatan</dt><dd className="text-right text-sm capitalize text-ink">{student.peminatan ?? 'Belum diatur'}</dd></div>
            <div className="flex items-start justify-between gap-4 px-3 py-3"><dt className="flex items-center gap-2 text-xs text-ink-tertiary"><Phone size={14} aria-hidden="true" /> Telepon</dt><dd className="text-right text-sm text-ink">{student.no_telepon || 'Belum diisi'}</dd></div>
            <div className="flex items-start justify-between gap-4 px-3 py-3"><dt className="text-xs text-ink-tertiary">Akun login</dt><dd className="text-right text-sm text-ink">{student.user_id ? 'Terhubung' : 'Belum dibuat'}</dd></div>
          </dl>

          <div className="flex items-center justify-between rounded-xl border border-hairline bg-surface-2 px-3 py-3">
            <span className="text-xs text-ink-subtle">Riwayat perubahan</span>
            <AuditHistoryButton tableName="students" recordId={student.id} />
          </div>
        </div>

        {canManage && (
          <SheetFooter className="border-t border-hairline bg-surface-1 px-4 pb-[env(safe-area-inset-bottom)]">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={handleEdit} className="min-h-11 border-hairline text-ink"><Pencil size={16} className="mr-2" aria-hidden="true" />Edit</Button>
              {canManageStatus && !student.user_id && onProvisionAccount && <Button type="button" onClick={handleProvisionAccount} className="min-h-11"><KeyRound size={16} className="mr-2" aria-hidden="true" />Buat akun</Button>}
              {canManageStatus && student.is_active && !student.user_id && onLinkLegacyAccount && <Button type="button" variant="outline" onClick={handleLinkLegacyAccount} className="col-span-2 min-h-11 border-hairline text-ink"><Link2 size={16} className="mr-2 text-primary" aria-hidden="true" />Tautkan akun lama</Button>}
              {canManageStatus && student.user_id && <Button type="button" variant="outline" onClick={handleToggleActive} className="col-span-2 min-h-11 border-hairline text-ink">{student.is_active ? <><UserX size={16} className="mr-2 text-semantic-warning" aria-hidden="true" />Nonaktifkan sebagai alumni</> : <><UserCheck size={16} className="mr-2 text-semantic-success" aria-hidden="true" />Aktifkan kembali</>}</Button>}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
