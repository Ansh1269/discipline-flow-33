import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { onInstallAvailable, promptInstall } from "@/lib/pwa";
import { toast } from "sonner";

const DISMISS_KEY = "disciplineos.install.dismissed";

export function InstallPrompt() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY)) setDismissed(true);
    return onInstallAvailable(setAvailable);
  }, []);

  if (!available || dismissed) return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,420px)]">
      <div className="glass rounded-2xl p-4 flex items-center gap-3 shadow-lg border border-border">
        <div className="size-10 rounded-xl bg-emerald/15 grid place-items-center shrink-0">
          <Download className="size-5 text-emerald" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Install DisciplineOS</p>
          <p className="text-xs text-muted-foreground">Add to your device for offline access and faster launch.</p>
        </div>
        <button
          onClick={async () => {
            const r = await promptInstall();
            if (r === "accepted") toast.success("Installing DisciplineOS");
            else if (r === "dismissed") { localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }
          }}
          className="px-3 py-2 rounded-xl bg-emerald text-emerald-foreground text-sm font-medium hover:opacity-90"
        >
          Install
        </button>
        <button
          aria-label="Dismiss install prompt"
          onClick={() => { localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }}
          className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}