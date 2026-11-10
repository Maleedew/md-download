import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-2.5", className)} {...props} />;
}

/** A pill-shaped radio option. Children are rendered inside the pill. */
function RadioPill({ className, children, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-pill"
      className={cn(
        "group flex min-h-14 cursor-pointer flex-col items-start justify-center rounded-2xl border border-input bg-secondary/40 px-4 py-2 text-left outline-none transition-all hover:border-primary/50 hover:bg-secondary data-[state=checked]:border-primary data-[state=checked]:bg-accent data-[state=checked]:shadow-[0_0_0_1px_var(--electric)]",
        className,
      )}
      {...props}
    >
      {children}
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioPill };
