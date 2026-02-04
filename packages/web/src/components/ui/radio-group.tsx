import * as React from "react";
import { cn } from "@/lib/utils";

export const RadioGroup = React.forwardRef<HTMLFieldSetElement, React.ComponentProps<"fieldset">>(
  ({ className, ...props }, ref) => (
    <fieldset ref={ref} className={cn("grid gap-2", className)} {...props} />
  ),
);
RadioGroup.displayName = "RadioGroup";

export const RadioItem = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type ?? "radio"}
      className={cn(
        "size-4 border border-input bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
RadioItem.displayName = "RadioItem";
