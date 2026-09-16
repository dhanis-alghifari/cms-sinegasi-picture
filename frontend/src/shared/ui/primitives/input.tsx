import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/shared/utils/cn"

type InputProps = React.ComponentProps<"input"> & {
  density?: "default" | "compact"
}

function Input({
  className,
  type,
  density = "default",
  ...props
}: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-density={density}
      className={cn(
        density === "compact"
          ? "h-[var(--touch-target-min)] md:h-8"
          : "h-[var(--control-height-mobile)] md:h-[var(--control-height-desktop)]",
        "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-[color,border-color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary-focus focus-visible:ring-1 focus-visible:ring-primary-focus/50 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
