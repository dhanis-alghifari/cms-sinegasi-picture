import { useState } from 'react';
import { ArrowLeft, ChevronRight, KeyRound, LogOut, UserRound } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

import { ConfirmDialog } from '@/shared/ui/ActionDialog';
import { Button } from '@/shared/ui/primitives/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/primitives/sheet';
import { cn } from '@/shared/utils/cn';
import {
  isNavigationItemActive,
  type NavigationGroup,
  type NavigationItem,
} from '@/app/navigation/navigationPolicy';

interface MobileNavigationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: NavigationGroup[];
  onChangePassword: () => void;
  onLogout: () => void;
}

const ACCOUNT_GROUP_ID = 'account';
const ACCOUNT_GROUP: NavigationGroup = {
  id: ACCOUNT_GROUP_ID,
  label: 'Akun',
  icon: UserRound,
  items: [],
  collapsible: true,
};

function MobileNavigationItem({
  item,
  onNavigate,
}: {
  item: NavigationItem;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) => cn(
        'flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1',
        isActive
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-ink',
      )}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 truncate">{item.label}</span>
    </NavLink>
  );
}

function MobileNavigationGroupButton({
  group,
  isActive,
  onSelect,
}: {
  group: NavigationGroup;
  isActive: boolean;
  onSelect: () => void;
}) {
  const GroupIcon = group.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 text-left text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1',
        isActive
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-ink',
      )}
      aria-label={`Buka menu ${group.label}`}
    >
      <GroupIcon size={20} strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{group.label}</span>
      <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

export function MobileNavigationSheet({
  open,
  onOpenChange,
  groups,
  onChangePassword,
  onLogout,
}: MobileNavigationSheetProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const location = useLocation();
  const selectedGroup = selectedGroupId === ACCOUNT_GROUP_ID
    ? ACCOUNT_GROUP
    : groups.find((group) => group.id === selectedGroupId) ?? null;
  const isAccountGroup = selectedGroupId === ACCOUNT_GROUP_ID;
  const selectedGroupDescription = isAccountGroup
    ? 'Kelola akun Anda.'
    : 'Pilih menu yang ingin dibuka.';

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedGroupId(null);
      setIsLogoutConfirmOpen(false);
    }
    onOpenChange(nextOpen);
  };

  const closeAfterNavigation = () => handleOpenChange(false);

  const handleChangePassword = () => {
    handleOpenChange(false);
    onChangePassword();
  };

  const handleLogout = () => {
    handleOpenChange(false);
    onLogout();
  };

  const renderRootMenu = () => (
    <>
      {groups.map((group) => {
        const item = group.items[0];
        if (!item) return null;
        if (!group.collapsible) {
          return <MobileNavigationItem key={item.id} item={item} onNavigate={closeAfterNavigation} />;
        }

        const isActive = group.items.some((navigationItem) => isNavigationItemActive(navigationItem, location.pathname));
        return (
          <MobileNavigationGroupButton
            key={group.id}
            group={group}
            isActive={isActive}
            onSelect={() => setSelectedGroupId(group.id)}
          />
        );
      })}
      <MobileNavigationGroupButton
        group={ACCOUNT_GROUP}
        isActive={isAccountGroup}
        onSelect={() => setSelectedGroupId(ACCOUNT_GROUP_ID)}
      />
    </>
  );

  const renderSelectedGroup = () => {
    if (isAccountGroup) {
      return (
        <div className="space-y-3">
          <NavLink
            to="/pengaturan/keamanan"
            onClick={handleChangePassword}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-hairline bg-surface-2 px-4 text-base text-ink-subtle hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1"
          >
            <KeyRound size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>Ganti password</span>
          </NavLink>

          <div className="border-t border-hairline pt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsLogoutConfirmOpen(true)}
              className="min-h-12 w-full justify-start gap-3 rounded-xl border border-semantic-danger/30 bg-semantic-danger/5 px-4 text-base text-semantic-danger hover:bg-semantic-danger/10"
            >
              <LogOut size={20} strokeWidth={1.75} aria-hidden="true" />
              <span>Keluar dari akun</span>
            </Button>
          </div>
        </div>
      );
    }

    return selectedGroup?.items.map((item) => (
      <MobileNavigationItem key={item.id} item={item} onNavigate={closeAfterNavigation} />
    ));
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[min(88dvh,44rem)] max-h-[min(88dvh,44rem)] gap-0 rounded-t-2xl border-hairline bg-surface-1 pb-0"
        >
          <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-ink-subtle/30" />

          <SheetHeader className="shrink-0 px-4 pb-3 pt-4">
            {selectedGroup ? (
              <div className="flex items-center gap-2 pr-10">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedGroupId(null)}
                  aria-label="Kembali ke menu lainnya"
                  className="shrink-0 text-ink-subtle"
                >
                  <ArrowLeft size={20} aria-hidden="true" />
                </Button>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-ink">{selectedGroup.label}</SheetTitle>
                  <SheetDescription className="truncate text-ink-subtle">{selectedGroupDescription}</SheetDescription>
                </div>
              </div>
            ) : (
              <>
                <SheetTitle className="pr-10 text-ink">Menu lainnya</SheetTitle>
                <SheetDescription className="text-ink-subtle">Pilih modul yang tersedia untuk peran Anda.</SheetDescription>
              </>
            )}
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-3">
              {selectedGroup ? renderSelectedGroup() : renderRootMenu()}
            </div>
          </div>

          {selectedGroup && (
            <SheetFooter className="shrink-0 border-t border-hairline bg-surface-1 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedGroupId(null)}
                className="min-h-12 w-full justify-start gap-3 rounded-xl px-4 text-base"
              >
                <ArrowLeft size={20} aria-hidden="true" />
                <span>Kembali ke menu lainnya</span>
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        dialog={{ open: isLogoutConfirmOpen, onOpenChange: setIsLogoutConfirmOpen }}
        content={{
          title: 'Keluar dari akun?',
          description: 'Sesi Anda akan diakhiri dan Anda perlu masuk kembali untuk mengakses aplikasi.',
        }}
        action={{ confirmLabel: 'Keluar dari akun', onConfirm: handleLogout }}
        destructive
      />
    </>
  );
}
