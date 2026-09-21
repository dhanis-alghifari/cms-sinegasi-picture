import type { ElementType } from 'react';
import {
  Bell, CalendarCheck, CalendarDays, Camera, GraduationCap, History, Layers, LayoutDashboard,
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

export type NavigationGroup = {
  id: string;
  label: string;
  icon: ElementType;
  items: NavigationItem[];
  collapsible: boolean;
};

export type NavigationSubject = AuthUser | UserRole | null | undefined;

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { id: 'dashboard', to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', mobilePriority: 1 },
  { id: 'students', to: '/students', icon: Users, label: 'Siswa', requiredCapabilities: ['students.read'], mobilePriority: 2 },
  { id: 'classes', to: '/classes', icon: Layers, label: 'Kelas', requiredCapabilities: ['classes.read'] },
  { id: 'attendance', to: '/attendance', icon: CalendarCheck, label: 'Absensi', requiredCapabilities: ['attendance.read', 'attendance.read.own'], mobilePriority: 3 },
  { id: 'cash', to: '/cash', icon: Wallet, label: 'Uang Kas', requiredCapabilities: ['cash.read', 'cash.read.own'], mobilePriority: 2 },
  { id: 'grades', to: '/grades', icon: GraduationCap, label: 'Nilai', requiredCapabilities: ['grades.read', 'grades.read.own'], mobilePriority: 3 },
  { id: 'equipment', to: '/equipment', icon: Camera, label: 'Alat', requiredCapabilities: ['equipment.read'], mobilePriority: 2 },
  { id: 'borrowing', to: '/borrowing', icon: PackageCheck, label: 'Peminjaman', requiredCapabilities: ['borrowing.read'], mobilePriority: 3 },
  { id: 'contests', to: '/contests', icon: Trophy, label: 'Lomba', requiredCapabilities: ['contests.read'] },
  { id: 'agenda', to: '/agenda', icon: CalendarDays, label: 'Agenda', requiredCapabilities: ['agenda.read'] },
  { id: 'notifications', to: '/notifications', icon: Bell, label: 'Notifikasi', requiredCapabilities: ['notifications.read'], mobilePriority: 4 },
  { id: 'audit', to: '/audit-logs', icon: History, label: 'Audit Trail', requiredCapabilities: ['audit.read'] },
  { id: 'users', to: '/users', icon: Users, label: 'Pengguna', requiredCapabilities: ['users.manage'] },
  { id: 'access-control', to: '/access-control', icon: ShieldCheck, label: 'Pengaturan Akses', requiredCapabilities: ['access_control.read'] },
];

type NavigationGroupDefinition = {
  id: string;
  label: string;
  icon: ElementType;
  itemIds: readonly string[];
  collapsible: boolean;
};

const NAVIGATION_GROUPS: readonly NavigationGroupDefinition[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, itemIds: ['dashboard'], collapsible: false },
  { id: 'academic', label: 'Akademik', icon: GraduationCap, itemIds: ['students', 'classes', 'attendance', 'grades'], collapsible: true },
  { id: 'cash', label: 'Uang Kas', icon: Wallet, itemIds: ['cash'], collapsible: false },
  { id: 'inventory', label: 'Inventaris', icon: PackageCheck, itemIds: ['equipment', 'borrowing'], collapsible: true },
  { id: 'activities', label: 'Kegiatan', icon: CalendarDays, itemIds: ['contests', 'agenda'], collapsible: true },
  { id: 'notifications', label: 'Notifikasi', icon: Bell, itemIds: ['notifications'], collapsible: false },
  { id: 'administration', label: 'Administrasi', icon: ShieldCheck, itemIds: ['audit', 'users', 'access-control'], collapsible: true },
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

export function getVisibleNavigationGroups(subject?: NavigationSubject): NavigationGroup[] {
  const visibleItems = new Map(getVisibleNavigationItems(subject).map((item) => [item.id, item]));

  return NAVIGATION_GROUPS.flatMap((group) => {
    const items = group.itemIds.flatMap((itemId) => {
      const item = visibleItems.get(itemId);
      return item ? [item] : [];
    });

    if (items.length === 0) return [];

    return [{
      ...group,
      items,
      // A filtered group with one child should not add an unnecessary click.
      collapsible: group.collapsible && items.length > 1,
    }];
  });
}

export function getMobileNavigationItems(subject?: NavigationSubject): NavigationItem[] {
  return getVisibleNavigationItems(subject)
    .filter((item) => item.mobilePriority !== undefined)
    .sort((a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99))
    .slice(0, 5);
}

export function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function getNavigationLabel(pathname: string): string {
  const match = NAVIGATION_ITEMS.find((item) => isNavigationItemActive(item, pathname));
  return match?.label ?? 'Sinegasi CMS';
}
