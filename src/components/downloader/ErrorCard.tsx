import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-input bg-secondary/40 p-6 text-center sm:p-8">
      <div className="flex size-14 items-center justify-center rounded-full border-2 border-foreground/70 text-foreground">
        <TriangleAlert className="size-7" />
      </div>
      <div className="max-w-md">
        <h3 className="text-lg font-semibold">That didn't work</h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <RotateCcw />
        Try again
      </Button>
    </div>
  );
}
