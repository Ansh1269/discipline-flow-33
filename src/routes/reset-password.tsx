import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — DisciplineOS" },
      { name: "description", content: "Reset your DisciplineOS account password." },
      { property: "og:title", content: "Reset password — DisciplineOS" },
      { property: "og:description", content: "Reset your DisciplineOS account password." },
      { property: "og:url", content: "https://discipline-flow-33.lovable.app/reset-password" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://discipline-flow-33.lovable.app/reset-password" }],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-svh grid place-items-center px-4">
      <form onSubmit={submit} className="glass w-full max-w-md p-8 rounded-3xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald/15 grid place-items-center"><Sparkles className="size-5 text-emerald" /></div>
          <h1 className="font-display text-xl font-bold">Set a new password</h1>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="np">New password</Label>
          <Input id="np" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-emerald hover:bg-emerald/90 text-emerald-foreground">
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Update password"}
        </Button>
      </form>
    </div>
  );
}