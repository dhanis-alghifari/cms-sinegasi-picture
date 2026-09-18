import type { ReactNode } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
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
  const handleValueChange = (nextValue: unknown) => {
    if (typeof nextValue === 'string') onValueChange(nextValue);
  };

  return (
    <Tabs
      value={value}
      onValueChange={handleValueChange}
      id={id}
      className={cn('w-full', className)}
    >
      <TabsList
        aria-label={ariaLabel}
        className="grid auto-cols-fr grid-flow-col items-center gap-1 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const tabId = `${id}-${tab.value}`;

          return (
            <TabsTrigger
              key={tab.value}
              id={tabId}
              aria-controls={ariaControls}
              value={tab.value}
              disabled={tab.disabled}
              className="min-w-32 px-3 py-2 text-xs"
            >
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
