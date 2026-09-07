import {
  createFileRoute,
  Link,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Printer,
  Sparkles,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
  updated_at: string;
  merchant_id: string | null;
};

type RecoveryPayment = {
  id: string;
  order_id: string;
  payment_id: string | null;
  provider: string;
  status: string;
  amount_cents: number;
  currency: string;
  created_at: string;
};

const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

export const Route = createFileRoute("/customer/receipt/$transactionId")({
  head: () => ({
    meta: [
      { title: "Payment Receipt — RecoverAI" },
      {
        name: "description",
        content:
          "Your RecoverAI payment receipt and confirmation details.",
      },
      { property: "og:title", content: "Payment Receipt — RecoverAI" },
      {
        property: "og:description",
        content: "Your RecoverAI payment receipt and confirmation details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const navigate = useNavigate();
  const params = useParams({ from: "/customer/receipt/$transactionId" });
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

  const { data: tx, isLoading: txLoading } = useQuery({
    queryKey: ["customer-receipt-tx", params.transactionId],
    enabled: !!params.transactionId && !!userEmail,
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

  const { data: payment, isLoading: paymentLoading } = useQuery({
    queryKey: ["customer-receipt-payment", params.transactionId],
    enabled: !!params.transactionId && !!userEmail,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recovery_payments")
        .select("*")
        .eq("transaction_id", params.transactionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as RecoveryPayment | null;
    },
  });

  const isLoading = txLoading || paymentLoading || !userEmail;

  const downloadReceipt = () => {
    if (!tx || !payment) return;
    const lines = [
      "RecoverAI — Payment Receipt",
      "================================",
      `Receipt for: ${tx.customer_name}`,
      `Email: ${tx.customer_email}`,
      `Payment ID: ${payment.payment_id ?? payment.order_id}`,
      `Reference: ${payment.order_id}`,
      `Date: ${formatDate(payment.created_at)}`,
      `Status: ${tx.status === "recovered" ? "Paid" : tx.status}`,
      `Amount: ${money(tx.amount_cents, tx.currency)}`,
      `Payment method: ${tx.payment_method}`,
      `Provider: ${payment.provider}`,
      "",
      "Thank you for your payment.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${payment.order_id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tx && userEmail && tx.customer_email.toLowerCase() !== userEmail.toLowerCase()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-panel">
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            Not authorized
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This receipt does not belong to your account.
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

  if (!tx) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-panel">
          <XCircle className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            Receipt not found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We could not find a completed payment with that ID.
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
              <p className="text-xs text-muted-foreground">Payment receipt</p>
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

        <Card className="overflow-hidden rounded-2xl border-border shadow-soft">
          <CardHeader className="bg-emerald-500/10 pb-6 pt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-foreground">
              Payment successful
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Thank you, {tx.customer_name}. Your payment has been received.
            </p>
          </CardHeader>

          <CardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount paid</span>
              <span className="text-xl font-semibold text-foreground">
                {money(tx.amount_cents, tx.currency)}
              </span>
            </div>

            <Separator />

            <div className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Payment ID</span>
                <span className="font-medium text-foreground">
                  {payment?.payment_id ?? payment?.order_id ?? tx.id}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-medium text-foreground">
                  {payment?.order_id ?? "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Date & time</span>
                <span className="font-medium text-foreground">
                  {formatDate(payment?.created_at ?? tx.recovered_at ?? tx.failed_at)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-emerald-600">
                  {tx.status === "recovered" ? "Paid" : tx.status}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Payment method</span>
                <span className="font-medium text-foreground">
                  {tx.payment_method}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-medium capitalize text-foreground">
                  {payment?.provider ?? "Simulated"}
                </span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 bg-secondary/50 p-6 sm:flex-row">
            <Button
              variant="outline"
              onClick={downloadReceipt}
              disabled={!payment}
              className="w-full rounded-xl gap-2"
            >
              <Download className="h-4 w-4" />
              Download receipt
            </Button>
            <Button
              onClick={() => window.print()}
              variant="outline"
              className="w-full rounded-xl gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </CardFooter>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          A copy of this receipt has been emailed to{" "}
          <span className="font-medium text-foreground">{tx.customer_email}</span>.
        </p>
      </main>
    </div>
  );
}
