
import { useState } from "react";
import { MoreVertical, Edit2, KeyRound, Link2, UserCheck, UserX } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/primitives/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/primitives/dropdown-menu";
import { Button } from "@/shared/ui/primitives/button";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { EmptyState } from "@/shared/ui/EmptyState";
import { AuditHistoryButton } from "@/features/audit/components/AuditHistoryButton";
import { useCanViewAuditHistory } from "@/features/audit/hooks/useCanViewAuditHistory";
import type { Student } from "../types/students.types";

interface StudentAvatarProps {
  fotoUrl?: string;
  nama: string;
}

function StudentAvatar({ fotoUrl, nama }: StudentAvatarProps) {
  const [isError, setIsError] = useState(false);

  // If fotoUrl changes, allow retry
  return fotoUrl && !isError ? (
    <img
      key={fotoUrl}
      src={fotoUrl}
      alt={nama}
      onError={() => setIsError(true)}
      className="w-7 h-7 rounded-full object-cover shrink-0 border border-hairline bg-surface-2"
    />
  ) : (
    <div className="w-7 h-7 rounded-full bg-surface-3 border border-hairline flex items-center justify-center shrink-0 text-ink-subtle text-[11px] uppercase font-bold">
      {nama.charAt(0)}
    </div>
  );
}

interface StudentTableProps {
  students: Student[];
  onEdit: (student: Student) => void;
  onToggleActive: (student: Student) => void;
  onProvisionAccount?: (student: Student) => void;
  onLinkLegacyAccount?: (student: Student) => void;
  canManage?: boolean;
  canManageStatus?: boolean;
}

export function StudentTable({
  students,
  onEdit,
  onToggleActive,
  onProvisionAccount,
  onLinkLegacyAccount,
  canManage = true,
  canManageStatus = false,
}: StudentTableProps) {
  const canViewAuditHistory = useCanViewAuditHistory();

  if (students.length === 0) {
    return (
      <EmptyState
        title="Tidak ada data siswa"
        description="Belum ada data siswa terdaftar yang sesuai dengan filter pencarian saat ini."
      />
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 overflow-hidden">
      <Table>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="border-hairline">
            <TableHead className="text-ink-subtle text-xs font-semibold">
              NIS
            </TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">
              Nama Siswa
            </TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">
              Kelas
            </TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">
              Peminatan Crew
            </TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">
              No. Telepon
            </TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">
              Status
            </TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">
              Akun Login
            </TableHead>
            {canViewAuditHistory && (
              <TableHead className="text-right text-ink-subtle text-xs font-semibold">
                Riwayat
              </TableHead>
            )}
            {canManage && (
              <TableHead className="text-right text-ink-subtle text-xs font-semibold">
                Aksi
              </TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {students.map((student) => (
            <TableRow
              key={student.id}
              className="border-hairline hover:bg-surface-2/40"
            >
              <TableCell className="text-ink-muted text-xs font-mono">
                {student.nis}
              </TableCell>
              <TableCell className="text-ink text-xs font-medium">
                <div className="flex items-center gap-2.5">
                  <StudentAvatar
                    fotoUrl={student.foto_url}
                    nama={student.nama}
                  />
                  {student.nama}
                </div>
              </TableCell>
              <TableCell className="text-ink-muted text-xs">
                {student.kelas}
              </TableCell>
              <TableCell className="text-ink-muted text-xs capitalize">
                {student.peminatan ?? "-"}
              </TableCell>
              <TableCell className="text-ink-subtle text-xs">
                {student.no_telepon ?? "-"}
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={student.is_active ? "Aktif" : "Alumni / Nonaktif"}
                  variant={student.is_active ? "success" : "neutral"}
                />
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={student.user_id ? "Terhubung" : "Belum dibuat"}
                  variant={student.user_id ? "success" : "warning"}
                />
              </TableCell>
              {canViewAuditHistory && (
                <TableCell className="text-right">
                  <AuditHistoryButton tableName="students" recordId={student.id} />
                </TableCell>
              )}
              {canManage && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-ink-subtle hover:text-ink"
                        >
                          <MoreVertical size={14} />
                        </Button>
                      }
                    />
                    <DropdownMenuContent
                      align="end"
                      className="bg-surface-3 border-hairline text-ink"
                    >
                      <DropdownMenuItem
                        onClick={() => onEdit(student)}
                        className="text-xs cursor-pointer"
                      >
                        <Edit2 size={14} className="mr-2 text-ink-subtle" />
                        Edit Data
                      </DropdownMenuItem>
                      {canManageStatus && !student.user_id && onProvisionAccount && (
                        <DropdownMenuItem
                          onClick={() => onProvisionAccount(student)}
                          className="text-xs cursor-pointer"
                        >
                          <KeyRound size={14} className="mr-2 text-primary" />
                          Buat Akun Anggota
                        </DropdownMenuItem>
                      )}
                      {canManageStatus && student.is_active && !student.user_id && onLinkLegacyAccount && (
                        <DropdownMenuItem
                          onClick={() => onLinkLegacyAccount(student)}
                          className="text-xs cursor-pointer"
                        >
                          <Link2 size={14} className="mr-2 text-primary" />
                          Tautkan akun lama
                        </DropdownMenuItem>
                      )}
                      {canManageStatus && (
                        <DropdownMenuItem
                          onClick={() => onToggleActive(student)}
                          className="text-xs cursor-pointer"
                        >
                          {student.is_active ? (
                            <>
                              <UserX size={14} className="mr-2 text-semantic-warning" />
                              Nonaktifkan (Alumni)
                            </>
                          ) : (
                            <>
                              <UserCheck size={14} className="mr-2 text-semantic-success" />
                              Aktifkan Kembali
                            </>
                          )}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
