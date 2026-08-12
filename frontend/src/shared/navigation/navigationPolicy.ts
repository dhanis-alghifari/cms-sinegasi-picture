import type { ElementType } from 'react';
import {
  Bell, CalendarCheck, Camera, GraduationCap, History, Layers, LayoutDashboard,
  PackageCheck, ShieldCheck, Trophy, Users, Wallet,
} from 'lucide-react';
import type { AuthUser } from '@/features/auth/types/auth.types';
import type { UserRole } from '@/shared/types/common';
import { hasAnyCapability, type Capability } from '@/shared/auth/capabilities';

export type NavigationItem = {
  id: string;
  to: string;
  icon: ElementType;
  label: string;
  requiredCapabilities?: Capability[];
  /** Kept for compatibility with older feature navigation declarations. */
  roles?: UserRole[];
  mobilePriority?: number;
};

export type NavigationSubject = AuthUser | UserRole | null | undefined;

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { id: 'dashboard', to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', mobilePriority: 1 },
  { id: 'students', to: '/students', icon: Users, label: 'Siswa', requiredCapabilities: ['students.read'], mobilePriority: 2 },
  { id: 'classes', to: '/classes', icon: Layers, label: 'Kelas', requiredCapabilities: ['classes.read'] },
  { id: 'attendance', to: '/attendance', icon: CalendarCheck, label: 'Absensi', requiredCapabilities: ['attendance.read'], mobilePriority: 3 },
  { id: 'cash', to: '/cash', icon: Wallet, label: 'Uang Kas', requiredCapabilities: ['cash.read'], mobilePriority: 2 },
  { id: 'grades', to: '/grades', icon: GraduationCap, label: 'Nilai', requiredCapabilities: ['grades.read', 'grades.read.own'], mobilePriority: 3 },
  { id: 'equipment', to: '/equipment', icon: Camera, label: 'Alat', requiredCapabilities: ['equipment.read'], mobilePriority: 2 },
  { id: 'borrowing', to: '/borrowing', icon: PackageCheck, label: 'Peminjaman', requiredCapabilities: ['borrowing.read'], mobilePriority: 3 },
  { id: 'contests', to: '/contests', icon: Trophy, label: 'Lomba', requiredCapabilities: ['contests.read'] },
  { id: 'notifications', to: '/notifications', icon: Bell, label: 'Notifikasi', requiredCapabilities: ['notifications.read'], mobilePriority: 4 },
  { id: 'audit', to: '/audit-logs', icon: History, label: 'Audit Trail', requiredCapabilities: ['audit.read'] },
  { id: 'users', to: '/users', icon: Users, label: 'Pengguna', requiredCapabilities: ['users.manage'] },
  { id: 'access-control', to: '/access-control', icon: ShieldCheck, label: 'Pengaturan Akses', requiredCapabilities: ['access_control.read'] },
];

function canSee(item: NavigationItem, subject: NavigationSubject): boolean {
  if (item.requiredCapabilities?.length) return hasAnyCapability(subject, item.requiredCapabilities);
  if (item.roles?.length) {
    const role = typeof subject === 'string' ? subject : subject?.role;
    return Boolean(role && item.roles.includes(role));
  }
  return true;
}

export function getVisibleNavigationItems(subject?: NavigationSubject): NavigationItem[] {
  return NAVIGATION_ITEMS.filter((item) => canSee(item, subject));
}

export function getMobileNavigationItems(subject?: NavigationSubject): NavigationItem[] {
  return getVisibleNavigationItems(subject)
    .filter((item) => item.mobilePriority !== undefined)
    .sort((a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99))
    .slice(0, 5);
}

export function getNavigationLabel(pathname: string): string {
  const match = NAVIGATION_ITEMS.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  return match?.label ?? 'Sinegasi CMS';
}
