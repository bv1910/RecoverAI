import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, RefreshCw, Sparkles, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Transaction = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  failure_reason: string;
  payment_method: string;
  attempts: number;
  failed_at: string;
  updated_at: string;
};

const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);

const STATUS_COPY: Record<string, string> = {
  failed: "Payment failed",
  in_progress: "Retry in progress",
  escalated: "Under review",
  recovered: "Paid",
  lost: "Unable to recover",
};

const statusPill = (status: string) => {
  if (status === "recovered") return "bg-emerald-50 text-emerald-700";
  if (status === "in_progress" || status === "escalated")
    return "bg-amber-50 text-amber-700";
  if (status === "lost") return "bg-rose-50 text-rose-700";
  return "bg-secondary text-muted-foreground";
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "recovered")
    return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (status === "lost") return <XCircle className="h-5 w-5 text-rose-600" />;
  return <Clock className="h-5 w-5 text-amber-600" />;
};

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Payment Status — RecoverAI" },
      {
        name: "description",
        content:
          "Track the live status of your payments — see when a failed payment is retried, recovered or closed.",
      },
      { property: "og:title", content: "Payment Status — RecoverAI" },
      {
        property: "og:description",
        content:
          "Live status updates for your RecoverAI payments, refreshed automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaymentStatusPage,
});

function PaymentStatusPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
      setCheckedSession(true);
    });
  }, []);

  const {
    data: transactions = [],
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["payment-status", userEmail],
    enabled: !!userEmail,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, amount_cents, currency, status, failure_reason, payment_method, attempts, failed_at, updated_at",
        )
        .ilike("customer_email", userEmail!)
        .order("failed_at", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  useEffect(() => {
    if (!userEmail) return;
    const channel = supabase
      .channel("payment-status-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          void refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userEmail, refetch]);

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
              <p className="text-xs text-muted-foreground">Payment status</p>
            </div>
          </div>
          <Link to="/customer">
            <Button variant="outline" className="rounded-xl">
              My portal
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Your payment status
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This page updates automatically as each payment moves along.
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          {!checkedSession ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking your account…
            </div>
          ) : !userEmail ? (
            <div className="mt-8 rounded-xl border border-border bg-secondary p-6 text-center">
              <p className="text-sm font-medium text-foreground">
                Sign in to see your payments
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use the same email or phone number you paid with.
              </p>
              <Link to="/">
                <Button className="mt-4 rounded-xl">Sign in</Button>
              </Link>
            </div>
          ) : isLoading ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your payments…
            </div>
          ) : transactions.length === 0 ? (
            <div className="mt-8 rounded-xl border border-border bg-secondary p-6 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Nothing to show yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                No payments were found for {userEmail}.
              </p>
            </div>
          ) : (
            <>
              <ul className="mt-6 divide-y divide-border">
                {transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <StatusIcon status={tx.status} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {money(tx.amount_cents, tx.currency)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(tx.failed_at).toLocaleDateString()} ·{" "}
                          {tx.payment_method} · attempt {tx.attempts}
                        </p>
                        {tx.status !== "recovered" && tx.failure_reason ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {tx.failure_reason}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill(tx.status)}`}
                      >
                        {STATUS_COPY[tx.status] ?? tx.status.replace("_", " ")}
                      </span>
                      {["failed", "in_progress", "escalated"].includes(
                        tx.status,
                      ) ? (
                        <Link
                          to="/customer/recover/$transactionId"
                          params={{ transactionId: tx.id }}
                          className="text-xs font-semibold text-foreground underline underline-offset-4"
                        >
                          Complete payment
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-muted-foreground">
                Last updated{" "}
                {dataUpdatedAt
                  ? new Date(dataUpdatedAt).toLocaleTimeString()
                  : "—"}{" "}
                · refreshes every few seconds
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
