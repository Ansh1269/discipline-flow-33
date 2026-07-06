import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { AppLockGate } from "@/components/AppLockGate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <GatedShell />
  ),
});

function GatedShell() {
  const { user } = Route.useRouteContext();
  return (
    <AppLockGate userId={user.id}>
      <AppShell>
        <Outlet />
        <OnboardingMount />
      </AppShell>
    </AppLockGate>
  );
}

function OnboardingMount() {
  const { user } = Route.useRouteContext();
  return <OnboardingDialog userId={user.id} email={user.email ?? ""} />;
}