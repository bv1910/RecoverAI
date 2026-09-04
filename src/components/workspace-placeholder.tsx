import { useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function WorkspacePlaceholder({
  role,
  description,
}: {
  role: string;
  description: string;
}) {
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-panel">
        <span className="bg-brand-gradient mx-auto flex h-11 w-11 items-center justify-center rounded-xl text-brand-foreground">
          <Sparkles className="h-5 w-5" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-foreground">{role} workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <Button variant="outline" onClick={signOut} className="mt-7 rounded-xl">
          Sign out
        </Button>
      </div>
    </main>
  );
}
