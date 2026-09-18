"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/utils/cn"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-full items-center justify-center gap-1 overflow-y-hidden rounded-lg border border-hairline p-1 text-muted-foreground group-data-horizontal/tabs:min-h-[var(--touch-target-min)] group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:gap-1 data-[variant=line]:rounded-none data-[variant=line]:border-0 data-[variant=line]:p-0 md:w-fit md:group-data-horizontal/tabs:min-h-9",
  {
    variants: {
      variant: {
        default: "bg-surface-2",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn("relative", tabsListVariants({ variant }), className)}
      {...props}
    >
      <TabsPrimitive.Indicator
        aria-hidden="true"
        className="pointer-events-none absolute top-[var(--active-tab-top)] left-[var(--active-tab-left)] z-0 h-[var(--active-tab-height)] w-[var(--active-tab-width)] rounded-md bg-surface-1 shadow-sm transition-[left,top,width,height] duration-200 ease-out motion-reduce:transition-none group-data-[variant=line]/tabs-list:hidden"
      />
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative z-10 inline-flex min-h-[var(--touch-target-min)] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent bg-transparent px-3 py-2 text-sm font-medium whitespace-normal text-center text-ink-subtle transition-[background-color,color,box-shadow] duration-200 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-ink focus-visible:border-primary-focus focus-visible:ring-2 focus-visible:ring-primary-focus/50 focus-visible:ring-offset-0 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none md:min-h-9 md:whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent group-data-[variant=line]/tabs-list:data-active:text-ink dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "group-data-[variant=default]/tabs-list:data-active:bg-transparent group-data-[variant=default]/tabs-list:data-active:text-ink group-data-[variant=default]/tabs-list:data-active:font-semibold",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
