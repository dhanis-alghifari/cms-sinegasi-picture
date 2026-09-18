"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/shared/utils/cn"
import { formatSelectValueLabel } from '@/shared/utils/formatLabels'
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

type SelectItemOption = {
  value: unknown
  label: React.ReactNode
}

function getSelectItemText(children: React.ReactNode): string | undefined {
  const text = React.Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child)
      }

      if (!React.isValidElement<{ children?: React.ReactNode }>(child)) {
        return ''
      }

      return getSelectItemText(child.props.children) ?? ''
    })
    .join('')
    .trim()

  return text || undefined
}

function collectSelectItems(
  children: React.ReactNode,
  collected: SelectItemOption[] = []
): SelectItemOption[] {
  React.Children.forEach(children, (child) => {
    if (
      !React.isValidElement<{
        children?: React.ReactNode
        value?: unknown
        label?: string
      }>(child)
    ) {
      return
    }

    if (child.type === SelectItem) {
      const label = child.props.label ?? getSelectItemText(child.props.children)
      if (child.props.value !== undefined && label) {
        collected.push({ value: child.props.value, label })
      }
      return
    }

    collectSelectItems(child.props.children, collected)
  })

  return collected
}

function Select<Value = string, Multiple extends boolean | undefined = false>({
  children,
  items,
  itemToStringLabel,
  ...props
}: SelectPrimitive.Root.Props<Value, Multiple>) {
  const labelCatalog = items ?? collectSelectItems(children)
  const hasLabelCatalog = Array.isArray(labelCatalog)
    ? labelCatalog.length > 0
    : Boolean(labelCatalog)

  return (
    <SelectPrimitive.Root
      {...props}
      items={labelCatalog as SelectPrimitive.Root.Props<Value, Multiple>['items']}
      itemToStringLabel={
        hasLabelCatalog || items
          ? itemToStringLabel
          : (value) => formatSelectValueLabel(value)
      }
    >
      {children}
    </SelectPrimitive.Root>
  )
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "group/select-trigger flex w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-[color,border-color,box-shadow] duration-150 outline-none select-none focus-visible:border-primary-focus focus-visible:ring-1 focus-visible:ring-primary-focus/50 focus-visible:ring-offset-0 data-popup-open:border-primary/60 data-popup-open:bg-surface-2/50 data-popup-open:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-[var(--control-height-mobile)] md:data-[size=default]:h-[var(--control-height-desktop)] data-[size=sm]:h-[var(--touch-target-min)] md:data-[size=sm]:h-8 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground transition-transform duration-150 data-popup-open:rotate-180 motion-reduce:transition-none" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-[70]"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn("relative isolate z-[70] max-h-[min(var(--available-height),20rem)] w-(--anchor-width) min-w-36 origin-(--transform-origin) overscroll-contain overflow-x-hidden overflow-y-auto rounded-lg border border-hairline bg-surface-1 p-1 text-ink shadow-lg transition-[opacity,transform] duration-150 ease-out data-starting-style:translate-y-1 data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:translate-y-1 data-ending-style:scale-[0.98] data-ending-style:opacity-0 motion-reduce:transition-none motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-ending-style:translate-y-0", className)}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  label,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      label={label ?? (typeof children === "string" ? children : undefined)}
      className={cn(
        "relative flex min-h-[var(--touch-target-min)] w-full cursor-pointer items-center gap-1.5 rounded-md px-3 py-2.5 pr-8 text-sm outline-hidden select-none transition-colors duration-150 focus:bg-surface-2 focus:text-ink data-highlighted:bg-surface-2 data-selected:bg-primary/10 data-selected:text-ink not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 md:min-h-9 md:px-2.5 md:py-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-pointer items-center justify-center rounded-t-md bg-surface-1 py-1 text-ink-muted [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-pointer items-center justify-center rounded-b-md bg-surface-1 py-1 text-ink-muted [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
