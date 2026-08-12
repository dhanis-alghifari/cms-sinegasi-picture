// src/features/dashboard/components/StudentPersonalDashboard.tsx
// Dashboard widget — Personal Student Dashboard View (Student Role)

import { UserCheck, Wallet, GraduationCap, PackageCheck, Trophy, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatNumber } from '@/shared/utils/formatNumber';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatRoleLabel, formatStatusLabel } from '@/shared/utils/formatLabels';
import type { StudentPersonalSummary } from '../types/dashboard.types';

interface StudentPersonalDashboardProps {
  data?: StudentPersonalSummary;
}

export function StudentPersonalDashboard({ data }: StudentPersonalDashboardProps) {
  if (!data) return null;

  const { kehadiranBulanIni, tunggakanKas, nilaiTerakhir, peminjamanAktif, tugasLomba } = data;

  return (
    <div className="space-y-4 mt-6">
      <h2 className="text-ink font-semibold text-base tracking-tight">Ringkasan Pribadi Siswa</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kehadiran */}
        <Card className="bg-surface-1 border-hairline shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-ink text-xs font-medium">Kehadiran Bulan Ini</CardTitle>
            <UserCheck size={16} className="text-semantic-success" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-ink mb-2">
              {formatNumber(kehadiranBulanIni.persentase, { maximumFractionDigits: 1 })}% <span className="text-xs font-normal text-ink-subtle">Kehadiran</span>
            </div>
            <div className="text-xs text-ink-subtle space-y-1">
              <p>Hadir: <span className="text-ink font-medium">{formatNumber(kehadiranBulanIni.hadir)} hari</span></p>
              <p>Sakit/Izin: <span className="text-ink font-medium">{formatNumber(kehadiranBulanIni.sakit + kehadiranBulanIni.izin)} hari</span></p>
              <p>Alpha: <span className="text-semantic-danger font-medium">{formatNumber(kehadiranBulanIni.alpha)} hari</span></p>
            </div>
          </CardContent>
        </Card>

        {/* Tunggakan Kas */}
        <Card className="bg-surface-1 border-hairline shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-ink text-xs font-medium">Tunggakan Kas</CardTitle>
            <Wallet size={16} className={tunggakanKas.totalTunggakan > 0 ? 'text-semantic-danger' : 'text-semantic-success'} />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-ink mb-2">
              {formatCurrency(tunggakanKas.totalTunggakan)}
            </div>
            <p className="text-xs text-ink-subtle">
              Status: <span className="text-ink font-medium">{formatStatusLabel(tunggakanKas.statusPembayaranTerakhir)}</span>
            </p>
          </CardContent>
        </Card>

        {/* Nilai Terakhir */}
        <Card className="bg-surface-1 border-hairline shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-ink text-xs font-medium">Nilai Terakhir</CardTitle>
            <GraduationCap size={16} className="text-primary" />
          </CardHeader>
          <CardContent>
            {nilaiTerakhir ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-bold text-primary">{nilaiTerakhir.nilai}</span>
                  <div className="min-w-0">
                    <p className="text-ink text-xs font-medium truncate">{nilaiTerakhir.assignmentTitle}</p>
                    <p className="text-ink-tertiary text-[10px]">{formatDateShort(nilaiTerakhir.tanggal)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-tertiary italic">Belum ada nilai</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Peminjaman Aktif & Tugas Lomba */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-surface-1 border-hairline shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-ink text-xs font-medium flex items-center gap-2">
              <PackageCheck size={14} className="text-primary" />
              Peminjaman Alat Aktif ({formatNumber(peminjamanAktif.length)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {peminjamanAktif.length === 0 ? (
              <p className="text-xs text-ink-tertiary italic">Tidak ada alat yang sedang dipinjam</p>
            ) : (
              <div className="space-y-2">
                {peminjamanAktif.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-surface-2/60 text-xs">
                    <span className="text-ink font-medium">{item.namaAlat}</span>
                    <div className="flex items-center gap-1">
                      {item.isOverdue && <AlertTriangle size={12} className="text-semantic-danger" />}
                      <span className={item.isOverdue ? 'text-semantic-danger font-medium' : 'text-ink-subtle'}>
                        {formatDateShort(item.dueAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-hairline shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-ink text-xs font-medium flex items-center gap-2">
              <Trophy size={14} className="text-semantic-warning" />
              Tugas Lomba ({formatNumber(tugasLomba.length)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tugasLomba.length === 0 ? (
              <p className="text-xs text-ink-tertiary italic">Tidak ada tugas lomba saat ini</p>
            ) : (
              <div className="space-y-2">
                {tugasLomba.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-surface-2/60 text-xs">
                    <div>
                      <p className="text-ink font-medium">{item.namaFestival}</p>
                      <p className="text-ink-tertiary text-[10px]">Peran: {formatRoleLabel(item.roleInContest, item.roleInContest || '—')}</p>
                    </div>
                    <span className="text-primary font-medium">{formatStatusLabel(item.status)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
