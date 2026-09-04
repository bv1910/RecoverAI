import {
  createFileRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { retryCustomerPayment } from "@/lib/customer-recovery.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Transaction = {
  id: string;
  customer_name: string;
  customer_email: string;
  amount_cents: number;
  currency: string;
  status: string;
  failure_code: string;
  failure_reason: string;
  payment_method: string;
  attempts: number;
  failed_at: string;
  merchant_id: string | null;
};

const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);

export const Route = createFileRoute("/customer/recover/$transactionId")({
  head: () => ({
    meta: [
      { title: "Complete Payment — RecoverAI" },
      {
        name: "description",
        content:
          "Securely complete your outstanding payment in the RecoverAI customer portal.",
      },
      { property: "og:title", content: "Complete Payment — RecoverAI" },
      {
        property: "og:description",
        content:
          "Securely complete your outstanding payment in the RecoverAI customer portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecoveryPage,
});

function RecoveryPage() {
  const navigate = useNavigate();
  const params = useParams({ from: "/customer/recover/$transactionId" });
  const queryClient = useQueryClient();
  const retry = useServerFn(retryCustomerPayment);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [result, setResult] = useState<
    | { type: "success"; status: string }
    | { type: "error"; message: string }
    | null
  >(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/", replace: true });
        return;
      }
      setUserEmail(data.session.user.email ?? null);
    });
  }, [navigate]);

  const { data: tx, isLoading } = useQuery({
    queryKey: ["customer-transaction", params.transactionId],
    enabled: !!params.transactionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", params.transactionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Payment not found");
      return data as Transaction;
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => retry({ data: { transactionId: params.transactionId } }),
    onSuccess: (data) => {
      setResult({ type: "success", status: data.status });
      void queryClient.invalidateQueries({ queryKey: ["customer-transactions"] });
    },
    onError: (error: Error) => {
      setResult({ type: "error", message: error.message });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!cardNumber.trim() || !expiry.trim() || !cvc.trim()) return;
    setResult(null);
    retryMutation.mutate();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  if (isLoading || !userEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tx && tx.customer_email.toLowerCase() !== userEmail.toLowerCase()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-panel">
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            Not authorized
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This payment does not belong to your account.
          </p>
          <Button
            onClick={() => navigate({ to: "/customer" })}
            className="mt-6 rounded-xl"
          >
            Back to portal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-brand-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                RecoverAI
              </p>
              <p className="text-xs text-muted-foreground">Secure checkout</p>
            </div>
          </div>
          <Button variant="outline" onClick={signOut} className="rounded-xl">
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-10">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/customer" })}
          className="-ml-3 mb-4 gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to portal
        </Button>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
          {result?.type === "success" ? (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h1 className="mt-5 text-2xl font-semibold text-foreground">
                Payment {result.status === "recovered" ? "successful" : "in progress"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {result.status === "recovered"
                  ? "Thank you. Your payment has been completed and a receipt has been sent to your email."
                  : "We received your payment details and are processing the charge with your bank. We'll email you an update shortly."}
              </p>
              <Button
                onClick={() => navigate({ to: "/customer" })}
                className="mt-7 rounded-xl"
              >
                Return to portal
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">
                    Complete your payment
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Update your card and retry the charge securely.
                  </p>
                </div>
                <span className="shrink-0 rounded-xl bg-secondary px-3 py-1.5 text-sm font-semibold text-foreground">
                  {money(tx?.amount_cents ?? 0, tx?.currency)}
                </span>
              </div>

              <div className="mt-6 rounded-xl border border-border bg-secondary p-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {tx?.failure_reason ?? "Payment failed"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Attempt {tx?.attempts ?? 0} ·{" "}
                      {new Date(tx?.failed_at ?? Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardNumber" className="text-sm font-medium">
                    Card number
                  </Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="cardNumber"
                      placeholder="4242 4242 4242 4242"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="h-12 rounded-xl pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiry" className="text-sm font-medium">
                      Expiry
                    </Label>
                    <Input
                      id="expiry"
                      placeholder="MM / YY"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      className="h-12 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvc" className="text-sm font-medium">
                      CVC
                    </Label>
                    <Input
                      id="cvc"
                      type="password"
                      placeholder="123"
                      maxLength={4}
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value)}
                      className="h-12 rounded-xl"
                      required
                    />
                  </div>
                </div>

                {result?.type === "error" ? (
                  <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                    {result.message}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={retryMutation.isPending}
                  className="h-12 w-full rounded-xl text-sm font-semibold"
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {retryMutation.isPending
                    ? "Processing…"
                    : `Pay ${money(tx?.amount_cents ?? 0, tx?.currency)}`}
                </Button>
              </form>

              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Encrypted and PCI compliant
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
