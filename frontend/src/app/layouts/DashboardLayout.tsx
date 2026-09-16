
import { useState } from 'react';
import '@/app/styles/fonts.css';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, LogOut, MoreHorizontal } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Button } from '@/shared/ui/primitives/button';
import { Separator } from '@/shared/ui/primitives/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/primitives/sheet';
import { Toaster } from '@/shared/ui/primitives/toast';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { NotificationDropdown } from '@/features/notifications/components/NotificationDropdown';
import {
  getMobileNavigationItems,
  getNavigationLabel,
  getVisibleNavigationItems,
  type NavigationItem,
} from '@/app/navigation/navigationPolicy';

export function DashboardLayout() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const visibleNavItems = getVisibleNavigationItems(user);
  const mobileNavItems = getMobileNavigationItems(user);
  const mobileSecondaryItems = visibleNavItems.filter(
    (item) => !mobileNavItems.some((mobileItem) => mobileItem.id === item.id),
  );
  const pageLabel = getNavigationLabel(location.pathname);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const renderNavItem = (item: NavigationItem, mobile = false) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.id}
        to={item.to}
        onClick={() => setIsMoreOpen(false)}
        className={({ isActive }) => cn(
          mobile
            ? 'flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px]'
            : 'flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-sm',
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

  return (
    <div className="flex min-h-screen min-h-dvh overflow-hidden bg-canvas">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Lewati ke konten utama
      </a>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary">
            <span className="text-xs font-bold text-sidebar-primary-foreground">S</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">Sinegasi CMS</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navigasi utama">
          <ul className="space-y-0.5">
            {visibleNavItems.map((item) => <li key={item.id}>{renderNavItem(item)}</li>)}
          </ul>
        </nav>

        <Separator className="bg-sidebar-border" />
        <div className="shrink-0 p-3">
          <div className="mb-1 flex items-center gap-2.5 px-2 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
              <span className="text-xs font-medium uppercase text-sidebar-foreground/70">{user?.nama?.charAt(0) ?? '?'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{user?.nama ?? 'Pengguna'}</p>
              <p className="truncate text-xs capitalize text-sidebar-foreground/60">{user?.role ?? ''}</p>
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
          <NotificationDropdown />
        </header>

        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto pb-[calc(8.5rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
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

      <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <SheetContent side="bottom" className="max-h-[75dvh] rounded-t-2xl border-hairline bg-surface-1 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="px-4 pb-2">
            <SheetTitle className="text-ink">Menu lainnya</SheetTitle>
            <SheetDescription className="text-ink-subtle">Pilih modul yang tersedia untuk peran Anda.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 grid grid-cols-2 gap-2 overflow-y-auto px-4 pb-2 [scroll-padding-bottom:1rem]">
            {mobileSecondaryItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.id} to={item.to} onClick={() => setIsMoreOpen(false)} className={({ isActive }) => cn('flex min-h-14 items-center gap-3 rounded-xl border border-hairline px-3 text-sm text-ink-subtle', isActive ? 'border-primary/50 bg-primary/10 text-primary' : 'bg-surface-2 hover:bg-surface-3 hover:text-ink')}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            <NavLink to="/pengaturan/keamanan" onClick={() => setIsMoreOpen(false)} className="flex min-h-14 items-center gap-3 rounded-xl border border-hairline bg-surface-2 px-3 text-sm text-ink-subtle hover:bg-surface-3 hover:text-ink">
              <KeyRound size={18} aria-hidden="true" />
              <span>Ganti Password</span>
            </NavLink>
            <button type="button" onClick={handleLogout} className="flex min-h-14 items-center gap-3 rounded-xl border border-hairline bg-surface-2 px-3 text-left text-sm text-ink-subtle hover:bg-surface-3 hover:text-semantic-danger">
              <LogOut size={18} aria-hidden="true" />
              <span>Keluar</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Toaster />
    </div>
  );
}
