import { useState } from 'react';
import { KeyRound, Link2, Pencil, Phone, Trash2, UserCheck, UserRound, UserX } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/primitives/sheet';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { AuthenticatedImage } from '@/shared/ui/AuthenticatedImage';
import { ImagePreviewDialog } from '@/shared/ui/ImagePreviewDialog';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
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
    onDelete?: (student: Student) => void;
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
  const cacheScope = useAuthStore((state) => state.user?.id) ?? '';
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const { open, onOpenChange } = dialog;
  const { isMobile } = viewport;
  const { canManage = true, canManageStatus = false } = permissions ?? {};
  const { onEdit, onToggleActive, onDelete, onProvisionAccount, onLinkLegacyAccount } = actions;
  if (!student) return null;
  const photoEndpoint = `/api/students/${encodeURIComponent(student.id)}/photo`;
  const showProvisionAccount = Boolean(canManageStatus && !student.user_id && onProvisionAccount);

  const handleSheetOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setPreviewStudentId(null);
    onOpenChange(nextOpen);
  };

  const handleEdit = () => {
    handleSheetOpenChange(false);
    onEdit(student);
  };

  const handleProvisionAccount = () => {
    handleSheetOpenChange(false);
    onProvisionAccount?.(student);
  };

  const handleLinkLegacyAccount = () => {
    handleSheetOpenChange(false);
    onLinkLegacyAccount?.(student);
  };

  const handleToggleActive = () => {
    handleSheetOpenChange(false);
    onToggleActive(student);
  };

  const handleDelete = () => {
    handleSheetOpenChange(false);
    onDelete?.(student);
  };

  return (
    <>
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
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
            <AuthenticatedImage
              endpoint={photoEndpoint}
              cacheScope={cacheScope}
              alt=""
              className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-hairline bg-surface-2"
              fallback={<span aria-hidden="true" className="flex h-full w-full items-center justify-center rounded-2xl bg-surface-3 text-2xl font-semibold uppercase text-ink-subtle">{student.nama.charAt(0)}</span>}
            />
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-ink">{student.nama}</h3>
              <p className="font-mono text-sm text-ink-subtle">{student.nis}</p>
              <div className="mt-2"><StatusBadge label={student.is_active ? 'Aktif' : 'Alumni / Nonaktif'} variant={student.is_active ? 'success' : 'neutral'} /></div>
              <button type="button" onClick={() => setPreviewStudentId(student.id)} className="min-h-11 text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Lihat foto</button>
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
              <Button type="button" variant="outline" onClick={handleEdit} className={`${showProvisionAccount ? '' : 'col-span-2 '}min-h-11 border-hairline text-ink`}><Pencil size={16} className="mr-2" aria-hidden="true" />Edit</Button>
              {showProvisionAccount && <Button type="button" onClick={handleProvisionAccount} className="min-h-11"><KeyRound size={16} className="mr-2" aria-hidden="true" />Buat akun</Button>}
              {canManageStatus && student.is_active && !student.user_id && onLinkLegacyAccount && <Button type="button" variant="outline" onClick={handleLinkLegacyAccount} className="col-span-2 min-h-11 border-hairline text-ink"><Link2 size={16} className="mr-2 text-primary" aria-hidden="true" />Tautkan akun lama</Button>}
              {canManageStatus && student.user_id && <Button type="button" variant="outline" onClick={handleToggleActive} className="col-span-2 min-h-11 border-hairline text-ink">{student.is_active ? <><UserX size={16} className="mr-2 text-semantic-warning" aria-hidden="true" />Nonaktifkan sebagai alumni</> : <><UserCheck size={16} className="mr-2 text-semantic-success" aria-hidden="true" />Aktifkan kembali</>}</Button>}
              {canManageStatus && !student.is_active && onDelete && <Button type="button" variant="outline" onClick={handleDelete} className="col-span-2 min-h-11 border-semantic-danger/40 text-semantic-danger hover:bg-semantic-danger/10"><Trash2 size={16} className="mr-2" aria-hidden="true" />Hapus data permanen</Button>}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
    <ImagePreviewDialog
      open={open && previewStudentId === student.id}
      onOpenChange={(nextOpen) => { if (!nextOpen) setPreviewStudentId(null); }}
      src={photoEndpoint}
      alt={`Foto profil ${student.nama}`}
      title="Foto profil siswa"
      description={student.nama}
    />
    </>
  );
}
