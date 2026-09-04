import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Sparkles, TrendingUp, Mail, Phone, Store, User, Loader2 } from "lucide-react";

import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in to RecoverAI — Recover Lost Revenue" },
      {
        name: "description",
        content:
          "Sign in to RecoverAI to recover failed payments and abandoned checkouts. Continue as a merchant or customer with Google, email, or phone.",
      },
      { property: "og:title", content: "Sign in to RecoverAI" },
      {
        property: "og:description",
        content: "Recover failed payments and abandoned checkouts with RecoverAI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

type Role = "merchant" | "customer";

const ROLE_KEY = "recoverai.role";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.8 6.1C12.2 13.2 17.6 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.4-4.1 7.1-10.2 7.1-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.3 28.7a14.6 14.6 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.4 2.3-6.4 0-11.8-3.7-13.7-8.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("merchant");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState<"google" | "otp" | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  const routeForRole = (r: Role) => (r === "merchant" ? "/merchant" : "/customer");

  // Finish sign-in when the browser returns from Google with a session.
  useEffect(() => {
    let active = true;

    const settle = async (userId: string, email?: string | null, name?: string | null) => {
      const stored = (localStorage.getItem(ROLE_KEY) as Role | null) ?? "customer";
      await supabase
        .from("profiles")
        .upsert({ id: userId, email: email ?? null, full_name: name ?? null, role: stored });
      if (!active) return;
      navigate({ to: routeForRole(stored), replace: true });
    };

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (user) void settle(user.id, user.email, user.user_metadata?.['full_name'] as string | undefined);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user) void settle(user.id, user.email, user.user_metadata?.['full_name'] as string | undefined);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleGoogle = async () => {
    setMessage(null);
    setLoading("google");
    localStorage.setItem(ROLE_KEY, role);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(null);
      setMessage({ tone: "error", text: result.error.message ?? "Google sign-in failed. Try again." });
      return;
    }
    if (result.redirected) return;
  };

  const handleOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    setMessage(null);
    setLoading("otp");
    localStorage.setItem(ROLE_KEY, role);
    const { error } =
      method === "email"
        ? await supabase.auth.signInWithOtp({
            email: value.trim(),
            options: { emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithOtp({ phone: value.trim() });
    setLoading(null);
    setMessage(
      error
        ? { tone: "error", text: error.message }
        : {
            tone: "info",
            text:
              method === "email"
                ? "Check your inbox for a secure sign-in link."
                : "We sent a one-time code to your phone.",
          },
    );
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="bg-brand-gradient relative overflow-hidden px-8 py-12 text-brand-foreground lg:px-14 lg:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex h-full flex-col justify-between gap-12">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">RecoverAI</span>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-semibold leading-[1.1] lg:text-5xl">
              Recover the revenue you already earned.
            </h1>
            <p className="mt-5 text-base/relaxed text-brand-foreground/75">
              Intelligent recovery for failed payments, abandoned checkouts and overdue invoices —
              running quietly in the background for merchants and their customers.
            </p>

            <dl className="mt-10 grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <dt className="text-2xl font-semibold">38%</dt>
                <dd className="mt-1 text-sm text-brand-foreground/70">average recovery lift</dd>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <dt className="text-2xl font-semibold">$4.2B</dt>
                <dd className="mt-1 text-sm text-brand-foreground/70">payments monitored</dd>
              </div>
            </dl>
          </div>

          <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-brand-foreground/70">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Bank-grade encryption
            </li>
            <li className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> PCI DSS Level 1
            </li>
          </ul>
        </div>
      </section>

      <section className="flex items-center justify-center bg-background px-6 py-14 sm:px-10">
        <div className="w-full max-w-sm">
          <h2 className="text-3xl font-semibold text-foreground">Welcome to RecoverAI</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose how you're signing in — we'll take you to the right place.
          </p>

          <div className="mt-8">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              I am a
            </Label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {([
                { key: "merchant" as const, label: "Merchant", icon: Store, hint: "Recover revenue" },
                { key: "customer" as const, label: "Customer", icon: User, hint: "Manage payments" },
              ]).map((option) => {
                const Icon = option.icon;
                const selected = role === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setRole(option.key)}
                    aria-pressed={selected}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      selected
                        ? "border-primary bg-accent shadow-soft"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span className="mt-3 block text-sm font-semibold text-foreground">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={loading !== null}
            className="mt-6 h-12 w-full justify-center gap-3 rounded-xl border-border text-sm font-semibold hover:bg-secondary"
          >
            {loading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
            {([
              { key: "email" as const, label: "Email", icon: Mail },
              { key: "phone" as const, label: "Phone", icon: Phone },
            ]).map((tab) => {
              const Icon = tab.icon;
              const active = method === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setMethod(tab.key);
                    setValue("");
                    setMessage(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-card text-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleOtp} className="mt-4 space-y-3">
            <Input
              type={method === "email" ? "email" : "tel"}
              inputMode={method === "email" ? "email" : "tel"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={method === "email" ? "you@company.com" : "+1 555 000 1234"}
              aria-label={method === "email" ? "Email address" : "Phone number"}
              className="h-12 rounded-xl"
              required
            />
            <Button
              type="submit"
              disabled={loading !== null}
              className="h-12 w-full rounded-xl text-sm font-semibold"
            >
              {loading === "otp" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue with {method === "email" ? "email" : "phone"}
            </Button>
          </form>

          {message ? (
            <p
              className={`mt-4 text-sm ${
                message.tone === "error" ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {message.text}
            </p>
          ) : null}

          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            By continuing you agree to the RecoverAI Terms of Service and Privacy Policy.
          </p>
        </div>
      </section>
    </main>
  );
}
