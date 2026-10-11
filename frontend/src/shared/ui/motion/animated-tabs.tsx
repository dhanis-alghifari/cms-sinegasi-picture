import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/shared/utils/cn';

export type AnimatedTab = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type AnimatedTabsProps = {
  tabs: readonly AnimatedTab[];
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  ariaControls?: string;
  id?: string;
  className?: string;
};

export function AnimatedTabs({
  tabs,
  value,
  onValueChange,
  ariaLabel,
  ariaControls,
  id = 'animated-tabs',
  className,
}: AnimatedTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLButtonElement>('[data-active="true"]');
    if (!activeBtn) return;
    setIndicatorStyle({
      left: activeBtn.offsetLeft,
      width: activeBtn.offsetWidth,
    });
  }, []);

  useEffect(() => {
    updateIndicator();
  }, [value, updateIndicator]);

  // Recalculate on resize
  useEffect(() => {
    const observer = new ResizeObserver(updateIndicator);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateIndicator]);

  return (
    <div className={cn('w-full', className)}>
      <div
        ref={containerRef}
        role="tablist"
        aria-label={ariaLabel}
        data-slot="tabs-list"
        className="relative inline-flex w-full items-center justify-center gap-1 overflow-x-auto overflow-y-hidden rounded-lg border border-hairline bg-surface-2 p-1 md:w-fit"
      >
        {/* Sliding indicator */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute top-1 bottom-1 z-0 rounded-md bg-surface-1 shadow-sm"
          animate={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
            mass: 0.8,
          }}
        />

        {tabs.map((tab) => {
          const tabId = `${id}-${tab.value}`;
          const isActive = tab.value === value;

          return (
            <button
              key={tab.value}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={ariaControls}
              data-active={isActive}
              disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
              onClick={() => !tab.disabled && onValueChange(tab.value)}
              className={cn(
                'relative z-10 inline-flex min-h-[var(--touch-target-min)] min-w-32 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent bg-transparent px-5 py-2 text-xs font-medium whitespace-nowrap text-ink-subtle transition-colors duration-200 hover:text-ink focus-visible:border-primary-focus focus-visible:ring-2 focus-visible:ring-primary-focus/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 md:min-h-9 md:px-6',
                isActive && 'text-ink font-semibold',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
