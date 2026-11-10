import { useCallback, useEffect, useState } from "react";
import { CloudOff, Loader2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, getApiBase, setApiBase, type Health } from "@/lib/api";

export type ServerState =
  | { state: "checking" }
  | { state: "ok"; health: Health }
  | { state: "down"; reason: string };

export function useServerStatus() {
  const [status, setStatus] = useState<ServerState>({ state: "checking" });

  const recheck = useCallback(async () => {
    setStatus({ state: "checking" });
    try {
      const health = await api.health();
      if (!health.ytdlp || !health.ffmpeg) {
        setStatus({
          state: "down",
          reason: "The server is online but yt-dlp or ffmpeg is missing. Check the server logs.",
        });
      } else {
        setStatus({ state: "ok", health });
      }
    } catch {
      setStatus({
        state: "down",
        reason: "This site needs its download server (yt-dlp + ffmpeg). Connect your server to start downloading.",
      });
    }
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  return { status, recheck };
}

/** Shown only when the API can't be reached. Lets the owner paste the backend URL. */
export function ServerBanner({ status, onChanged }: { status: ServerState; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(getApiBase());
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (status.state !== "down") return null;

  const save = async () => {
    setTesting(true);
    setMessage(null);
    setApiBase(value);
    try {
      const h = await api.health();
      if (h.ok) {
        setOpen(false);
        onChanged();
      } else {
        setMessage("Reached the server, but yt-dlp or ffmpeg isn't available there.");
      }
    } catch {
      setMessage("Couldn't reach that address. Check the URL, and that the server allows this site (ALLOWED_ORIGINS).");
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <div
        role="status"
        className="mb-4 flex flex-col gap-4 rounded-2xl border border-dashed border-primary/50 bg-accent/50 p-4 text-left sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <CloudOff className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Download server not connected</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{status.reason}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="shrink-0 self-start sm:self-center">
          <Server />
          Connect server
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Connect your download server</DialogTitle>
          <DialogDescription>
            Paste the address of the md download API you deployed (for example on Render, Railway or your own server). It's
            saved in this browser only.
          </DialogDescription>
          <div className="mt-5 flex flex-col gap-3">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://your-server.example.com"
              inputMode="url"
              aria-label="Server URL"
              className="h-12"
              onKeyDown={(e) => e.key === "Enter" && !testing && void save()}
            />
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            <div className="mt-1 flex gap-3">
              <Button onClick={save} disabled={testing || !value.trim()} className="flex-1">
                {testing ? <Loader2 className="animate-spin" /> : null}
                Save & test
              </Button>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
