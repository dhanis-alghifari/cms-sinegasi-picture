import { Combobox } from '@base-ui/react/combobox';
import { Check, ChevronDown, Search } from 'lucide-react';
import { LazyMotion, MotionConfig } from 'motion/react';
import * as m from 'motion/react-m';

import { cn } from '@/shared/utils/cn';

const loadMotionFeatures = () => import('./motion/motion-features').then(({ default: features }) => features);

export type SearchableComboboxOption = {
  id: string;
  label: string;
  secondaryLabel?: string;
};

export interface SearchableComboboxProps<T extends SearchableComboboxOption> {
  options: T[];
  value?: string;
  selectedOption?: T | null;
  onValueChange: (value: string) => void;
  onSelectedOptionChange?: (option: T | null) => void;
  onSearchChange?: (value: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  errorMessage?: string;
  ariaLabel: string;
  triggerLabel: string;
  placeholder: string;
  emptyMessage: string;
  loadingMessage: string;
  inputId?: string;
  errorId?: string;
  className?: string;
}

export function SearchableCombobox<T extends SearchableComboboxOption>({
  options,
  value,
  selectedOption: selectedOptionProp,
  onValueChange,
  onSelectedOptionChange,
  onSearchChange,
  isLoading = false,
  disabled = false,
  errorMessage,
  ariaLabel,
  triggerLabel,
  placeholder,
  emptyMessage,
  loadingMessage,
  inputId,
  errorId,
  className,
}: SearchableComboboxProps<T>) {
  const selected = selectedOptionProp ?? options.find((option) => option.id === value) ?? null;
  const items = selected && !options.some((option) => option.id === selected.id)
    ? [selected, ...options]
    : options;
  const handleValueChange = (nextValue: T | null) => {
    onSelectedOptionChange?.(nextValue);
    onValueChange(nextValue?.id ?? '');
  };

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures}>
        <Combobox.Root<T>
          items={items}
          value={selected}
          onValueChange={handleValueChange}
          onInputValueChange={onSearchChange}
          filter={(option, query) => {
            const normalizedQuery = query.trim().toLocaleLowerCase();
            if (!normalizedQuery) return true;

            return [option.id, option.label, option.secondaryLabel]
              .filter(Boolean)
              .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery));
          }}
          itemToStringLabel={(option) => option.label}
          itemToStringValue={(option) => option.id}
          isItemEqualToValue={(option, selectedValue) => option.id === selectedValue.id}
        >
          <Combobox.InputGroup
            className={cn(
              'relative flex h-[var(--control-height-mobile)] w-full min-w-0 items-center rounded-md border border-hairline bg-surface-2 text-ink',
              'focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 md:h-[var(--control-height-desktop)]',
              errorMessage && 'border-semantic-danger focus-within:border-semantic-danger focus-within:ring-semantic-danger/30',
              className,
            )}
          >
            <Search size={15} aria-hidden="true" className="pointer-events-none ml-3 shrink-0 text-ink-tertiary" />
            <Combobox.Input
              id={inputId}
              aria-label={ariaLabel}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorId}
              placeholder={placeholder}
              disabled={disabled}
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs outline-none placeholder:text-ink-tertiary"
            />
            <Combobox.Trigger
              type="button"
              aria-label={triggerLabel}
              disabled={disabled}
              className="group/combobox-trigger my-0.5 mr-1 flex min-w-8 self-stretch shrink-0 items-center justify-center rounded text-ink-tertiary transition-colors duration-150 hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
            >
              <ChevronDown size={16} aria-hidden="true" className="transition-transform duration-150 group-data-popup-open/combobox-trigger:rotate-180 motion-reduce:transition-none" />
            </Combobox.Trigger>
          </Combobox.InputGroup>

          <Combobox.Portal>
            <Combobox.Positioner sideOffset={4} className="z-[70] w-[var(--anchor-width)] outline-none">
              <Combobox.Popup className="max-h-[min(var(--available-height),20rem)] overflow-hidden overscroll-contain rounded-lg border border-hairline bg-surface-1 p-1 text-ink shadow-lg">
                <m.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="origin-(--transform-origin)"
                >
                  <Combobox.List className="max-h-[calc(var(--available-height)-0.5rem)] overflow-y-auto overscroll-contain">
                    {isLoading && <div className="px-3 py-3 text-xs text-ink-tertiary" role="status">{loadingMessage}</div>}
                    <Combobox.Empty className="text-xs text-ink-tertiary">
                      {!isLoading && <span className="block px-3 py-3">{emptyMessage}</span>}
                    </Combobox.Empty>
                    {!isLoading && (
                      <Combobox.Collection>
                        {(option: T) => (
                          <Combobox.Item
                            key={option.id}
                            value={option}
                            className={cn(
                              'flex min-h-[var(--touch-target-min)] w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-xs outline-none transition-colors duration-150',
                              'data-highlighted:bg-surface-2 data-highlighted:text-ink data-selected:bg-primary/10 motion-reduce:transition-none',
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{option.label}</span>
                              {option.secondaryLabel && (
                                <span className="mt-0.5 block truncate text-[10px] text-ink-tertiary">{option.secondaryLabel}</span>
                              )}
                            </span>
                            <Combobox.ItemIndicator className="text-primary">
                              <Check size={15} aria-hidden="true" />
                            </Combobox.ItemIndicator>
                          </Combobox.Item>
                        )}
                      </Combobox.Collection>
                    )}
                  </Combobox.List>
                </m.div>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </LazyMotion>
    </MotionConfig>
  );
}
