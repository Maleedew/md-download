import { ArrowRight, ClipboardPaste, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  busy: boolean;
  disabled?: boolean;
}

export function UrlForm({ value, onChange, onSubmit, busy, disabled }: Props) {
  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        onChange(text);
        onSubmit(text);
      }
    } catch {
      /* clipboard permission denied – the user can paste manually */
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit(value);
      }}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <div className="relative flex-1">
        <Link2 className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste a video link here…"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Video link"
          disabled={disabled}
          className="pr-28 pl-13"
        />
        <button
          type="button"
          onClick={paste}
          disabled={disabled}
          className="absolute top-1/2 right-2.5 inline-flex h-9 -translate-y-1/2 cursor-pointer items-center gap-1.5 rounded-full bg-secondary px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <ClipboardPaste className="size-4" />
          Paste
        </button>
      </div>
      <Button type="submit" size="lg" className="btn-shine sm:min-w-44" disabled={disabled || busy || !value.trim()}>
        {busy ? (
          <>
            <span className="eq" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
            Analyzing
          </>
        ) : (
          <>
            Get video
            <ArrowRight />
          </>
        )}
      </Button>
    </form>
  );
}
