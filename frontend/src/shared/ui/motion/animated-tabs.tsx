import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { LazyMotion, MotionConfig, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';

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

const loadFeatures = () => import('./motion-features').then(({ default: features }) => features);

export function AnimatedTabs({
  tabs,
  value,
  onValueChange,
  ariaLabel,
  ariaControls,
  id = 'animated-tabs',
  className,
}: AnimatedTabsProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const shouldReduceMotion = useReducedMotion();

  const focusTab = (startIndex: number, direction: 1 | -1) => {
    for (let offset = 1; offset <= tabs.length; offset += 1) {
      const nextIndex = (startIndex + direction * offset + tabs.length * 2) % tabs.length;
      const nextTab = tabs[nextIndex];
      if (!nextTab || nextTab.disabled) continue;
      tabRefs.current[nextTab.value]?.focus();
      onValueChange(nextTab.value);
      return;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (tabs.length < 2) return;

    let direction: 1 | -1 | null = null;
    let startIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') direction = 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') direction = -1;
    if (event.key === 'Home') {
      direction = 1;
      startIndex = -1;
    }
    if (event.key === 'End') {
      direction = -1;
      startIndex = tabs.length;
    }
    if (!direction) return;

    event.preventDefault();
    focusTab(startIndex, direction);
  };

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures}>
        <div
          id={id}
          role="tablist"
          aria-label={ariaLabel}
          className={cn(
            'grid auto-cols-fr grid-flow-col items-center gap-1 overflow-x-auto rounded-lg border border-hairline bg-surface-2 p-1',
            className,
          )}
        >
          {tabs.map((tab, index) => {
            const isActive = tab.value === value;
            const tabId = `${id}-${tab.value}`;

            return (
              <button
                key={tab.value}
                ref={(element) => {
                  tabRefs.current[tab.value] = element;
                }}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={ariaControls}
                tabIndex={isActive ? 0 : -1}
                disabled={tab.disabled}
                onClick={() => onValueChange(tab.value)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  'relative inline-flex min-h-10 min-w-32 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap text-ink-subtle transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-focus/50 disabled:pointer-events-none disabled:opacity-50',
                  isActive && 'text-ink',
                )}
              >
                <span className="relative z-10">{tab.label}</span>
                {isActive && (
                  <m.span
                    layoutId={`${id}-active-indicator`}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-0 rounded-md bg-surface-1 shadow-sm"
                    initial={false}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
                  >
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
                  </m.span>
                )}
              </button>
            );
          })}
        </div>
      </LazyMotion>
    </MotionConfig>
  );
}
