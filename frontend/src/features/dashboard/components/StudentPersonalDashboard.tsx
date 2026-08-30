// src/features/dashboard/components/StudentPersonalDashboard.tsx
// Dashboard widget — Personal Student Dashboard View (Student Role)

import { UserCheck, Wallet, GraduationCap, ArrowRight, CircleCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatNumber } from '@/shared/utils/formatNumber';
import { formatDateShort } from '@/shared/utils/formatDate';
import type { StudentPersonalSummary } from '../types/dashboard.types';

interface StudentPersonalDashboardProps {
  data?: StudentPersonalSummary;
}

export function StudentPersonalDashboard({ data }: StudentPersonalDashboardProps) {
  if (!data) return null;

  const { kehadiran, kas, nilaiTerakhir } = data;

  return (
    <div className="space-y-4 mt-6">
      <h2 className="text-ink font-semibold text-base tracking-tight">Ringkasan Saya</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kehadiran */}
        <Card className="bg-surface-1 border-hairline shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-ink text-xs font-medium">Kehadiran Saya</CardTitle>
            <UserCheck size={16} className="text-semantic-success" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-ink mb-2">
              {formatNumber(kehadiran.persentase, { maximumFractionDigits: 1 })}% <span className="text-xs font-normal text-ink-subtle">Kehadiran</span>
            </div>
            <div className="text-xs text-ink-subtle space-y-1">
              <p>Hadir: <span className="text-ink font-medium">{formatNumber(kehadiran.hadir)} hari</span></p>
              <p>Sakit/Izin: <span className="text-ink font-medium">{formatNumber(kehadiran.sakit + kehadiran.izin)} hari</span></p>
              <p>Alpha: <span className="text-semantic-danger font-medium">{formatNumber(kehadiran.alpha)} hari</span></p>
            </div>
          </CardContent>
        </Card>

        {/* Tunggakan Kas */}
        <Card className="bg-surface-1 border-hairline shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-ink text-xs font-medium">Keuangan Kas</CardTitle>
            <Wallet size={16} className={kas.totalTunggakan > 0 ? 'text-semantic-danger' : 'text-semantic-success'} />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-ink mb-2">
              {formatCurrency(kas.totalTunggakan)}
            </div>
            <p className="text-xs text-ink-subtle">
              Sudah dibayar: <span className="text-ink font-medium">{formatCurrency(kas.totalDibayar)}</span>
            </p>
            <p className="mt-1 text-xs text-ink-subtle">{formatNumber(kas.jumlahPembayaran)} pembayaran tercatat</p>
            <Link to="/cash" className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary hover:underline">Lihat riwayat kas <ArrowRight size={13} /></Link>
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
            <Link to="/grades" className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary hover:underline">Lihat tugas & nilai <ArrowRight size={13} /></Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="bg-surface-1 border-hairline shadow-none">
          <CardHeader className="pb-2"><CardTitle className="text-ink text-xs font-medium flex items-center gap-2"><UserCheck size={14} className="text-primary" />Riwayat Kehadiran</CardTitle></CardHeader>
          <CardContent><p className="text-xs text-ink-subtle">Total {formatNumber(kehadiran.total)} catatan kehadiran tersimpan.</p><Link to="/attendance" className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary hover:underline">Lihat seluruh riwayat <ArrowRight size={13} /></Link></CardContent>
        </Card>
        <Card className="bg-surface-1 border-hairline shadow-none">
          <CardHeader className="pb-2"><CardTitle className="text-ink text-xs font-medium flex items-center gap-2"><CircleCheck size={14} className="text-semantic-success" />Pembayaran Terbaru</CardTitle></CardHeader>
          <CardContent>{kas.riwayatPembayaran.length === 0 ? <p className="text-xs text-ink-tertiary italic">Belum ada pembayaran kas.</p> : <div className="space-y-2">{kas.riwayatPembayaran.slice(0, 3).map((item) => <div key={item.id ?? item.date} className="flex items-center justify-between rounded bg-surface-2/60 px-2 py-1.5 text-xs"><span className="text-ink">{item.keterangan}</span><span className="font-medium text-semantic-success">{formatCurrency(item.nominal)}</span></div>)}</div>}</CardContent>
        </Card>
      </div>
    </div>
  );
}
