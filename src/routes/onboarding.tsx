import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, Loader2, ReceiptText, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { completeOnboarding, getOnboardingStatus } from "@/lib/onboarding.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Business Setup — RecoverAI" },
      {
        name: "description",
        content:
          "Set up your business on RecoverAI and record your first failed payment to see it recovered on the dashboard.",
      },
      { property: "og:title", content: "Business Setup — RecoverAI" },
      {
        property: "og:description",
        content: "Two quick steps: add your business, log a failed payment, start recovering revenue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AUD", "CAD", "SGD", "AED"];

const FAILURES = [
  { code: "insufficient_funds", label: "Insufficient funds" },
  { code: "expired_card", label: "Card expired" },
  { code: "do_not_honor", label: "Issuer declined (do not honor)" },
  { code: "processor_error", label: "Processor error" },
  { code: "authentication_required", label: "3D Secure not completed" },
  { code: "unknown", label: "Other / unknown" },
];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [currency, setCurrency] = useState("USD");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [failureCode, setFailureCode] = useState("insufficient_funds");
  const [paymentMethod, setPaymentMethod] = useState("card");

  const status = useServerFn(getOnboardingStatus);
  const finish = useServerFn(completeOnboarding);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const { data: existing } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => status(),
  });

  useEffect(() => {
    if (!existing) return;
    if (existing.businessName) setBusinessName((v) => v || existing.businessName);
    if (existing.businessWebsite) setBusinessWebsite((v) => v || existing.businessWebsite);
    if (existing.currency) setCurrency((v) => (v === "USD" ? existing.currency : v));
  }, [existing]);

  const submit = useMutation({
    mutationFn: () =>
      finish({
        data: {
          businessName,
          businessWebsite,
          currency,
          customerName,
          customerEmail,
          amountCents: Math.round(Number(amount) * 100),
          failureCode,
          failureReason: "",
          paymentMethod,
        },
      }),
    onSuccess: () => navigate({ to: "/merchant" }),
    onError: (err: Error) => setError(err.message),
  });

  const goNext = () => {
    if (businessName.trim().length < 2) {
      setError("Enter your business name to continue.");
      return;
    }
    setError(null);
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-5 py-4">
          <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-brand-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-foreground">RecoverAI</p>
            <p className="text-xs text-muted-foreground">Business setup</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="mb-6 flex items-center gap-3 text-xs font-semibold">
          <span
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${
              step === 1 ? "bg-brand-gradient text-brand-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" /> 1. Your business
          </span>
          <span className="h-px flex-1 bg-border" />
          <span
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${
              step === 2 ? "bg-brand-gradient text-brand-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            <ReceiptText className="h-3.5 w-3.5" /> 2. First failed payment
          </span>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-xl font-semibold text-foreground">
                  Tell us about your business
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  This appears on recovery messages your customers receive.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business">Business name</Label>
                <Input
                  id="business"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Northwind Coffee Roasters"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="website">Website (optional)</Label>
                  <Input
                    id="website"
                    value={businessWebsite}
                    onChange={(e) => setBusinessWebsite(e.target.value)}
                    placeholder="northwind.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button onClick={goNext} className="rounded-xl">
                Continue <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-xl font-semibold text-foreground">
                  Record your first failed payment
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  The AI Recovery Agent will score it and suggest the safest recovery action.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cname">Customer name</Label>
                  <Input
                    id="cname"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Priya Sharma"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cemail">Customer email</Label>
                  <Input
                    id="cemail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="priya@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ({currency})</Label>
                  <Input
                    id="amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="129.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="method">Payment method</Label>
                  <select
                    id="method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="wallet">Wallet</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="failure">Why did it fail?</Label>
                  <select
                    id="failure"
                    value={failureCode}
                    onChange={(e) => setFailureCode(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {FAILURES.map((f) => (
                      <option key={f.code} value={f.code}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setError(null);
                    setStep(1);
                  }}
                >
                  Back
                </Button>
                <Button
                  className="rounded-xl"
                  disabled={submit.isPending}
                  onClick={() => {
                    setError(null);
                    submit.mutate();
                  }}
                >
                  {submit.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : null}
                  Finish setup
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
