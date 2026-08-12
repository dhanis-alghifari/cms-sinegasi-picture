import { useState, type ComponentProps } from 'react';
import { Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type ButtonVariant = ComponentProps<typeof Button>['variant'];

export interface ResponsivePageAction {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  onSelect: () => void;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
}

interface ResponsivePageActionsProps {
  actions: readonly ResponsivePageAction[];
  mobileLabel?: string;
  mobileDescription?: string;
}

const MOBILE_FAB_POSITION =
  'fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 size-15 rounded-xl p-0 shadow-lg';

function ActionButton({
  action,
  mobile = false,
  onSelect,
}: {
  action: ResponsivePageAction;
  mobile?: boolean;
  onSelect?: () => void;
}) {
  const Icon = action.icon;

  return (
    <Button
      type="button"
      variant={action.variant}
      onClick={onSelect ?? action.onSelect}
      disabled={action.disabled}
      className={cn(
        mobile ? 'min-h-14 w-full justify-start gap-3 text-left' : 'min-h-11 gap-1.5 text-xs md:min-h-9',
        action.className,
      )}
    >
      <Icon size={mobile ? 18 : 16} aria-hidden="true" />
      <span className={mobile && action.description ? 'min-w-0' : undefined}>
        <span className={mobile && action.description ? 'block font-semibold' : undefined}>
          {action.label}
        </span>
        {mobile && action.description && (
          <span className="mt-0.5 block text-xs font-normal opacity-80">
            {action.description}
          </span>
        )}
      </span>
    </Button>
  );
}

function MobileDirectAction({ action }: { action: ResponsivePageAction }) {
  const Icon = action.icon;

  return (
    <Button
      type="button"
      variant={action.variant}
      onClick={action.onSelect}
      disabled={action.disabled}
      title={action.label}
      aria-label={action.label}
      className={cn('bg-primary text-primary-foreground hover:bg-primary-hover', action.className, MOBILE_FAB_POSITION)}
    >
      <Icon size={24} aria-hidden="true" />
    </Button>
  );
}

export function ResponsivePageActions({
  actions,
  mobileLabel = 'Tindakan',
  mobileDescription = 'Pilih aktivitas yang ingin dilakukan.',
}: ResponsivePageActionsProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  if (actions.length === 0) {
    return null;
  }

  if (actions.length === 1) {
    const action = actions[0];

    return (
      <div data-slot="responsive-page-actions">
        <div className="hidden items-center gap-2 md:flex">
          <ActionButton action={action} />
        </div>
        <div className="md:hidden">
          <MobileDirectAction action={action} />
        </div>
      </div>
    );
  }

  return (
    <div data-slot="responsive-page-actions">
      <div className="hidden items-center gap-2 md:flex">
        {actions.map((action) => (
          <ActionButton key={action.id} action={action} />
        ))}
      </div>

      <div className="md:hidden">
        <Button
          type="button"
          aria-label={`Buka ${mobileLabel.toLowerCase()}`}
          aria-haspopup="dialog"
          aria-expanded={mobileOpen}
          title={mobileLabel}
          onClick={() => setMobileOpen(true)}
          className={cn('bg-primary text-primary-foreground hover:bg-primary-hover', MOBILE_FAB_POSITION)}
        >
          <Plus size={24} aria-hidden="true" />
        </Button>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[80dvh] overflow-y-auto rounded-t-2xl border-hairline bg-surface-1 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="border-b border-hairline px-4 pb-3">
              <SheetTitle className="text-ink">{mobileLabel}</SheetTitle>
              <SheetDescription className="text-ink-subtle">
                {mobileDescription}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-2 px-4 pt-1">
              {actions.map((action) => (
                <ActionButton
                  key={action.id}
                  action={action}
                  mobile
                  onSelect={() => {
                    setMobileOpen(false);
                    action.onSelect();
                  }}
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
