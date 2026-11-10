import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("rounded-3xl border bg-card text-card-foreground backdrop-blur-sm", className)}
      {...props}
    />
  );
}
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-6 sm:p-8", className)} {...props} />;
}

export { Card, CardContent };
