import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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

const STATUS_COPY: Record<string, string> = {
  failed: "Payment failed",
  in_progress: "Retry in progress",
  escalated: "Under review",
  recovered: "Paid",
  lost: "Unable to recover",
};

export const Route = createFileRoute("/customer")({
  head: () => ({
    meta: [
      { title: "Customer Portal — RecoverAI" },
      {
        name: "description",
        content:
          "Your RecoverAI customer portal for reviewing and completing outstanding payments.",
      },
      { property: "og:title", content: "Customer Portal — RecoverAI" },
      {
        property: "og:description",
        content:
          "Review and complete your outstanding payments in the RecoverAI portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerPortal,
});

function CustomerPortal() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/", replace: true });
        return;
      }
      setUserEmail(data.session.user.email ?? null);
    });
  }, [navigate]);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["customer-transactions", userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .ilike("customer_email", userEmail!)
        .in("status", ["failed", "in_progress", "escalated"])
        .order("failed_at", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-brand-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                RecoverAI
              </p>
              <p className="text-xs text-muted-foreground">Customer portal</p>
            </div>
          </div>
          <Button variant="outline" onClick={signOut} className="rounded-xl">
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <h1 className="text-2xl font-semibold text-foreground">
            Outstanding payments
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review and complete any payments that need your attention.
          </p>

          {isLoading ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your payments…
            </div>
          ) : transactions.length === 0 ? (
            <div className="mt-8 rounded-xl border border-border bg-secondary p-6 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="mt-3 text-sm font-medium text-foreground">
                You&apos;re all caught up
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                No outstanding payments were found for your account.
              </p>
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-border">
              {transactions.map((tx) => (
                <li key={tx.id}>
                  <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {money(tx.amount_cents, tx.currency)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {STATUS_COPY[tx.status] ?? tx.status.replace("_", " ")} ·{" "}
                          {tx.failure_reason}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Failed on {new Date(tx.failed_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/customer/recover/$transactionId"
                      params={{ transactionId: tx.id }}
                    >
                      <Button className="w-full rounded-xl text-sm font-semibold sm:w-auto">
                        Complete payment
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
