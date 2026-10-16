
import { useCallback, useRef, useState } from 'react';
import '@/app/styles/fonts.css';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Popover } from '@base-ui/react/popover';
import { ArrowLeft, Check, ChevronRight, KeyRound, LoaderCircle, LogOut, MoreHorizontal, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/shared/utils/cn';
import { Button } from '@/shared/ui/primitives/button';
import { Separator } from '@/shared/ui/primitives/separator';
import { AuthenticatedImage } from '@/shared/ui/AuthenticatedImage';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { usePullToRefresh } from '@/shared/hooks/usePullToRefresh';
import { formatRoleLabel } from '@/shared/utils/formatLabels';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { NotificationDropdown } from '@/features/notifications/components/NotificationDropdown';
import { MobileNavigationSheet } from './MobileNavigationSheet';
import {
  getMobileNavigationItems,
  getNavigationLabel,
  getVisibleNavigationGroups,
  isNavigationItemActive,
  type NavigationItem,
  type NavigationGroup,
} from '@/app/navigation/navigationPolicy';

export function DashboardLayout() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const mainContentRef = useRef<HTMLElement | null>(null);

  const refreshActiveQueries = useCallback(() => {
    if (!navigator.onLine) {
      return Promise.reject(new Error('REFRESH_OFFLINE'));
    }

    return queryClient.refetchQueries(
      { type: 'active' },
      { cancelRefetch: true, throwOnError: true },
    );
  }, [queryClient]);
  const { phase: refreshPhase, refresh } = usePullToRefresh({
    containerRef: mainContentRef,
    enabled: isMobile,
    resetKey: location.key,
    onRefresh: refreshActiveQueries,
  });

  const visibleNavigationGroups = getVisibleNavigationGroups(user);
  const mobileNavItems = getMobileNavigationItems(user);
  const mobileNavigationItemIds = new Set(mobileNavItems.map((item) => item.id));
  const [openDesktopGroupState, setOpenDesktopGroupState] = useState<{ pathname: string; groupId: string | null }>({
    pathname: location.pathname,
    groupId: null,
  });
  const openDesktopGroupId = openDesktopGroupState.pathname === location.pathname
    ? openDesktopGroupState.groupId
    : null;

  const mobileSecondaryGroups = visibleNavigationGroups.flatMap((group) => {
    const items = group.items.filter((item) => !mobileNavigationItemIds.has(item.id));
    if (items.length === 0) return [];

    return [{
      ...group,
      items,
      collapsible: group.collapsible && items.length > 1,
    }];
  });
  const pageLabel = getNavigationLabel(location.pathname);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const renderNavItem = (item: NavigationItem, mobile = false, nested = false) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.id}
        to={item.to}
        onClick={() => {
          setIsMoreOpen(false);
          setOpenDesktopGroupState({ pathname: location.pathname, groupId: null });
        }}
        className={({ isActive }) => cn(
          mobile
            ? 'flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px]'
            : cn('flex min-h-11 items-center gap-2.5 rounded-md py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar', nested ? 'pl-9 pr-3' : 'px-3'),
          isActive
            ? 'bg-sidebar-accent text-sidebar-primary font-medium'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        )}
      >
        <Icon size={mobile ? 18 : 17} strokeWidth={1.75} aria-hidden="true" />
        <span className={mobile ? 'max-w-full truncate' : undefined}>{item.label}</span>
      </NavLink>
    );
  };

  const renderDesktopGroup = (group: NavigationGroup) => {
    if (!group.collapsible) {
      const item = group.items[0];
      return item ? <li key={group.id}>{renderNavItem(item)}</li> : null;
    }

    const GroupIcon = group.icon;
    const isExpanded = openDesktopGroupId === group.id;
    const isActive = group.items.some((item) => isNavigationItemActive(item, location.pathname));

    return (
      <li key={group.id}>
        <Popover.Root
          open={isExpanded}
          onOpenChange={(open) => setOpenDesktopGroupState({
            pathname: location.pathname,
            groupId: open ? group.id : null,
          })}
        >
          <Popover.Trigger
            type="button"
            className={cn(
              'flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar motion-reduce:transition-none',
              isActive || isExpanded
                ? 'bg-sidebar-accent/80 text-sidebar-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            <GroupIcon size={17} strokeWidth={1.75} aria-hidden="true" />
            <span>{group.label}</span>
            <ChevronRight size={15} className="ml-auto" aria-hidden="true" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner
              side="right"
              align="start"
              sideOffset={8}
              collisionAvoidance={{ side: 'flip', align: 'shift' }}
              className="z-[70] outline-none"
            >
              <Popover.Popup className="max-h-[min(var(--available-height),24rem)] min-w-52 max-w-[calc(100vw-1rem)] overscroll-contain overflow-y-auto rounded-lg border border-sidebar-border bg-sidebar p-1.5 text-sidebar-foreground shadow-xl outline-none transition-[opacity,transform] duration-150 ease-out data-starting-style:translate-x-1 data-starting-style:opacity-0 data-ending-style:translate-x-1 data-ending-style:opacity-0 motion-reduce:transition-none motion-reduce:data-starting-style:translate-x-0 motion-reduce:data-ending-style:translate-x-0">
                <div className="px-2.5 pb-2 pt-1 text-xs font-semibold text-sidebar-foreground/60">
                  {group.label}
                </div>
                <nav aria-label={`Menu ${group.label}`}>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => <li key={item.id}>{renderNavItem(item)}</li>)}
                  </ul>
                </nav>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </li>
    );
  };

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-canvas">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Lewati ke konten utama
      </a>
      <aside className="hidden min-h-0 w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary">
            <span className="text-xs font-bold text-sidebar-primary-foreground">S</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">Sinegasi CMS</span>
        </div>

        <nav className="min-h-0 flex-1 overflow-hidden px-2 py-3" aria-label="Navigasi utama">
          <ul className="space-y-1">
            {visibleNavigationGroups.map(renderDesktopGroup)}
          </ul>
        </nav>

        <Separator className="bg-sidebar-border" />
        <div className="shrink-0 p-3">
          <div className="mb-1 flex items-center gap-2.5 px-2 py-2">
            <AuthenticatedImage
              key={user?.id ?? 'anonymous'}
              endpoint="/api/auth/me/photo"
              cacheScope={user?.id ?? ''}
              alt={`Foto profil ${user?.nama ?? 'pengguna'}`}
              className="h-7 w-7 shrink-0 rounded-full bg-sidebar-accent"
              fallback={<span aria-hidden="true" className="flex h-full w-full items-center justify-center text-xs font-medium uppercase text-sidebar-foreground/70">{user?.nama?.charAt(0) || '?'}</span>}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{user?.nama ?? 'Pengguna'}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{user ? formatRoleLabel(user.role) : ''}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-semantic-danger">
            <LogOut size={14} strokeWidth={1.75} aria-hidden="true" />
            Keluar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/pengaturan/keamanan')} className="w-full justify-start gap-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <KeyRound size={15} aria-hidden="true" />
            Ganti Password
          </Button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-surface-1 px-3 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            {isMobile && location.pathname !== '/dashboard' && (
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-ink-subtle" aria-label="Kembali">
                <ArrowLeft size={18} aria-hidden="true" />
              </Button>
            )}
            <span className="truncate text-sm font-medium text-ink lg:hidden">{pageLabel}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isMobile && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void refresh()}
                disabled={refreshPhase === 'refreshing'}
                aria-label={refreshPhase === 'refreshing' ? 'Memperbarui data' : 'Perbarui data'}
                title="Perbarui data"
              >
                <RefreshCw
                  size={18}
                  aria-hidden="true"
                  className={refreshPhase === 'refreshing' ? 'motion-safe:animate-spin' : undefined}
                />
              </Button>
            )}
            <NotificationDropdown />
          </div>
        </header>

        <main
          id="main-content"
          ref={mainContentRef}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable] pb-[calc(8.5rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
        >
          {isMobile && refreshPhase !== 'idle' && (
            <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-3">
              <div
                role="status"
                aria-live="polite"
                className="flex min-h-10 items-center gap-2 rounded-full border border-hairline bg-surface-1 px-4 py-2 text-xs font-medium text-ink shadow-md"
              >
                {refreshPhase === 'pulling' && 'Tarik untuk memperbarui'}
                {refreshPhase === 'ready' && 'Lepaskan untuk memperbarui'}
                {refreshPhase === 'refreshing' && <><LoaderCircle size={15} className="motion-safe:animate-spin" aria-hidden="true" /> Memperbarui data…</>}
                {refreshPhase === 'success' && <><Check size={15} aria-hidden="true" /> Data diperbarui</>}
                {refreshPhase === 'error' && 'Pembaruan gagal. Periksa koneksi, lalu ketuk ikon refresh untuk mencoba lagi.'}
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-sidebar-border bg-sidebar/95 px-2 pb-[env(safe-area-inset-bottom)] text-sidebar-foreground backdrop-blur lg:hidden">
        {mobileNavItems.map((item) => renderNavItem(item, true))}
        <button
          type="button"
          onClick={() => setIsMoreOpen(true)}
          className={cn('flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground', isMoreOpen && 'bg-sidebar-accent text-sidebar-primary')}
          aria-label="Buka menu lainnya"
          aria-expanded={isMoreOpen}
        >
          <MoreHorizontal size={18} aria-hidden="true" />
          <span>Lainnya</span>
        </button>
      </nav>

      <MobileNavigationSheet
        open={isMoreOpen}
        onOpenChange={setIsMoreOpen}
        groups={mobileSecondaryGroups}
        onChangePassword={() => navigate('/pengaturan/keamanan')}
        onLogout={handleLogout}
      />

    </div>
  );
}
