import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  CircleDollarSign,
  Download,
  Link2,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  analyzeOpenCases,
  analyzeTransaction,
  runRecoveryAction,
} from "@/lib/ai-recovery.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/merchant")({
  head: () => ({
    meta: [
      { title: "Merchant Dashboard — RecoverAI" },
      {
        name: "description",
        content:
          "Track revenue at risk, recovered revenue and active cases, and let the AI Recovery Agent resolve failed payments.",
      },
      { property: "og:title", content: "Merchant Dashboard — RecoverAI" },
      {
        property: "og:description",
        content: "Recover failed payments with AI-guided retries, payment links and reminders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MerchantDashboard,
});

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
};

type Analysis = {
  transaction_id: string;
  root_cause: string;
  recovery_probability: number;
  recommended_action: string;
  rationale: string;
};

const ACTIONS = [
  { key: "retry_payment", label: "Retry Payment", icon: RefreshCw },
  { key: "create_payment_link", label: "Create Payment Link", icon: Link2 },
  { key: "send_reminder", label: "Send Reminder", icon: Mail },
  { key: "escalate", label: "Escalate", icon: ShieldAlert },
] as const;

const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);

const STATUS_STYLE: Record<string, string> = {
  failed: "bg-destructive/10 text-destructive",
  in_progress: "bg-accent text-accent-foreground",
  recovered: "bg-emerald-500/10 text-emerald-700",
  escalated: "bg-amber-500/15 text-amber-700",
  lost: "bg-muted text-muted-foreground",
  refund: "bg-sky-500/10 text-sky-700",
};

const probabilityStyle = (probability: number) =>
  probability >= 65
    ? "bg-emerald-500/10 text-emerald-700"
    : probability >= 35
      ? "bg-amber-500/15 text-amber-700"
      : "bg-destructive/10 text-destructive";

const SAMPLE_HISTORY: {
  id: string;
  amount_cents: number;
  currency: string;
  date: string;
  status: string;
}[] = [
  { id: "pay_4f9c21a0", amount_cents: 8999, currency: "USD", date: "2026-09-03T14:22:00Z", status: "recovered" },
  { id: "pay_7d1e88b2", amount_cents: 14900, currency: "USD", date: "2026-09-02T09:10:00Z", status: "failed" },
  { id: "pay_2a6c54ef", amount_cents: 4200, currency: "USD", date: "2026-09-01T17:45:00Z", status: "in_progress" },
  { id: "pay_9b0d31fa", amount_cents: 12500, currency: "USD", date: "2026-08-30T11:05:00Z", status: "recovered" },
  { id: "pay_c3481e7d", amount_cents: 6700, currency: "USD", date: "2026-08-29T20:30:00Z", status: "escalated" },
  { id: "pay_5e2f90bc", amount_cents: 9800, currency: "USD", date: "2026-08-28T08:15:00Z", status: "recovered" },
  { id: "pay_8a1d6f3c", amount_cents: 5400, currency: "USD", date: "2026-08-27T13:40:00Z", status: "refund" },
  { id: "pay_6b4e2d90", amount_cents: 11200, currency: "USD", date: "2026-08-26T10:20:00Z", status: "failed" },
];


function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
        STATUS_STYLE[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof CircleDollarSign;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-soft ${
        accent ? "bg-brand-gradient border-transparent text-brand-foreground" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            accent ? "text-brand-foreground/75" : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
        <Icon className={`h-4 w-4 ${accent ? "text-brand-foreground/80" : "text-muted-foreground"}`} />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
      <p className={`mt-1 text-xs ${accent ? "text-brand-foreground/70" : "text-muted-foreground"}`}>
        {hint}
      </p>
    </div>
  );
}

function MerchantDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [sweepDone, setSweepDone] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");

  const analyze = useServerFn(analyzeTransaction);
  const analyzeAll = useServerFn(analyzeOpenCases);
  const act = useServerFn(runRecoveryAction);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("failed_at", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const { data: analyses = {} } = useQuery({
    queryKey: ["ai_analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_analyses")
        .select("transaction_id, root_cause, recovery_probability, recommended_action, rationale");
      if (error) throw error;
      return Object.fromEntries((data as Analysis[]).map((row) => [row.transaction_id, row]));
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, status, details, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const refreshAnalyses = () => {
    queryClient.invalidateQueries({ queryKey: ["ai_analyses"] });
    queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
  };

  const analyzeMutation = useMutation({
    mutationFn: (transactionId: string) => analyze({ data: { transactionId } }),
    onSuccess: refreshAnalyses,
    onError: (error: Error) => setBanner(error.message),
  });

  const sweepMutation = useMutation({
    mutationFn: (onlyMissing: boolean) => analyzeAll({ data: { onlyMissing } }),
    onSuccess: (result) => {
      if (result.analyzed > 0) {
        setBanner(
          `AI Recovery Agent analyzed ${result.analyzed} failed transaction${
            result.analyzed === 1 ? "" : "s"
          }.`,
        );
      }
      refreshAnalyses();
    },
    onError: (error: Error) => setBanner(error.message),
  });

  const actionMutation = useMutation({
    mutationFn: (vars: { transactionId: string; action: string }) => act({ data: vars }),
    onSuccess: (result) => {
      setBanner(result.outcome);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
    },
    onError: (error: Error) => setBanner(error.message),
  });

  // Analyze every unanalyzed failed transaction once the dashboard loads.
  const unanalyzedCount = transactions.filter(
    (t) => ["failed", "in_progress", "escalated"].includes(t.status) && !analyses[t.id],
  ).length;

  useEffect(() => {
    if (sweepDone || isLoading || unanalyzedCount === 0 || sweepMutation.isPending) return;
    setSweepDone(true);
    sweepMutation.mutate(true);
  }, [sweepDone, isLoading, unanalyzedCount, sweepMutation]);


  const openCases = transactions.filter((t) =>
    ["failed", "in_progress", "escalated"].includes(t.status),
  );
  const atRisk = openCases.reduce((sum, t) => sum + t.amount_cents, 0);
  const recovered = transactions
    .filter((t) => t.status === "recovered")
    .reduce((sum, t) => sum + t.amount_cents, 0);
  const rate = atRisk + recovered > 0 ? Math.round((recovered / (atRisk + recovered)) * 100) : 0;

  const filteredHistory = SAMPLE_HISTORY.filter((row) => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return true;
    return row.id.toLowerCase().includes(q) || row.status.toLowerCase().includes(q);
  });

  const downloadHistoryCsv = () => {
    const header = ["Payment ID", "Amount", "Currency", "Date", "Status"];
    const lines = filteredHistory.map((row) => [
      row.id,
      (row.amount_cents / 100).toFixed(2),
      row.currency,
      new Date(row.date).toISOString(),
      row.status,
    ]);
    const csv = [header, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transaction-history.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selected = transactions.find((t) => t.id === selectedId) ?? null;
  const selectedAnalysis = selected ? analyses[selected.id] : undefined;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-brand-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-foreground">RecoverAI</p>
              <p className="text-xs text-muted-foreground">Merchant workspace</p>
            </div>
          </div>
          <Button variant="outline" onClick={signOut} className="rounded-xl">
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Revenue at risk"
            value={money(atRisk)}
            hint={`${openCases.length} unresolved payments`}
            icon={AlertTriangle}
            accent
          />
          <MetricCard
            label="Revenue recovered"
            value={money(recovered)}
            hint="Settled after intervention"
            icon={CircleDollarSign}
          />
          <MetricCard
            label="Recovery rate"
            value={`${rate}%`}
            hint="Recovered vs. total exposed"
            icon={ArrowUpRight}
          />
          <MetricCard
            label="Active cases"
            value={String(openCases.length)}
            hint="Awaiting an action"
            icon={BadgeCheck}
          />
        </div>

        {banner ? (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-soft">
            <span>{banner}</span>
            <button
              onClick={() => setBanner(null)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Failed transactions</h2>
                <p className="text-xs text-muted-foreground">
                  Every failed payment is scored by the AI Recovery Agent.
                </p>
              </div>
              <Button
                variant="outline"
                className="rounded-xl text-xs"
                disabled={sweepMutation.isPending}
                onClick={() => sweepMutation.mutate(false)}
              >
                {sweepMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
                Re-analyze all
              </Button>
            </div>


            {isLoading ? (
              <p className="px-5 py-10 text-sm text-muted-foreground">Loading cases…</p>
            ) : transactions.length === 0 ? (
              <p className="px-5 py-10 text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {transactions.map((tx) => {
                  const active = tx.id === selectedId;
                  return (
                    <li key={tx.id}>
                      <button
                        onClick={() => setSelectedId(tx.id)}
                        className={`flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition-colors ${
                          active ? "bg-accent/60" : "hover:bg-secondary"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {tx.customer_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {tx.failure_reason} · {tx.attempts} attempt
                            {tx.attempts === 1 ? "" : "s"}
                          </p>
                          {analyses[tx.id] ? (
                            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${probabilityStyle(
                                  analyses[tx.id]!.recovery_probability,
                                )}`}
                              >
                                <Bot className="h-3 w-3" />
                                {analyses[tx.id]!.recovery_probability}% recoverable
                              </span>
                              <span className="text-muted-foreground">
                                Safest:{" "}
                                {ACTIONS.find((a) => a.key === analyses[tx.id]!.recommended_action)
                                  ?.label ?? analyses[tx.id]!.recommended_action}
                              </span>
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {sweepMutation.isPending ? "AI analyzing…" : "Not analyzed yet"}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusPill status={tx.status} />
                          <span className="text-sm font-semibold text-foreground">
                            {money(tx.amount_cents, tx.currency)}
                          </span>
                        </div>

                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">AI Recovery Agent</h2>
              </div>

              {!selected ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Pick a case from the list to get a root cause, recovery probability and a
                  recommended next step.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-sm font-semibold text-foreground">{selected.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{selected.customer_email}</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {money(selected.amount_cents, selected.currency)}
                    </p>
                  </div>

                  <Button
                    onClick={() => analyzeMutation.mutate(selected.id)}
                    disabled={analyzeMutation.isPending}
                    className="w-full rounded-xl"
                  >
                    {analyzeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {selectedAnalysis ? "Re-analyze case" : "Analyze case"}
                  </Button>

                  {selectedAnalysis ? (
                    <div className="space-y-3 rounded-xl border border-border p-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Root cause
                        </p>
                        <p className="mt-1 text-sm text-foreground">{selectedAnalysis.root_cause}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Recovery probability
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="bg-brand-gradient h-full rounded-full"
                              style={{ width: `${selectedAnalysis.recovery_probability}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            {selectedAnalysis.recovery_probability}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Safest recommended action
                        </p>
                        <p className="mt-1 text-sm font-semibold text-primary">
                          {ACTIONS.find((a) => a.key === selectedAnalysis.recommended_action)?.label ??
                            selectedAnalysis.recommended_action}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedAnalysis.rationale}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    {ACTIONS.map((action) => {
                      const Icon = action.icon;
                      const recommended = selectedAnalysis?.recommended_action === action.key;
                      return (
                        <Button
                          key={action.key}
                          variant={recommended ? "default" : "outline"}
                          disabled={actionMutation.isPending}
                          onClick={() =>
                            actionMutation.mutate({
                              transactionId: selected.id,
                              action: action.key,
                            })
                          }
                          className="h-auto justify-start gap-2 rounded-xl px-3 py-3 text-xs font-semibold"
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h2 className="text-base font-semibold text-foreground">Audit log</h2>
              {logs.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Every action you take is recorded here.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {logs.map((log) => (
                    <li key={log.id} className="text-sm">
                      <p className="font-medium capitalize text-foreground">
                        {log.action.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()} ·{" "}
                        {(log.details as { outcome?: string })?.outcome ?? log.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-card shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Transaction history</h2>
              <p className="text-xs text-muted-foreground">
                Recent payments across all recovery stages.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder="Search by payment ID or status"
                  className="h-9 w-full rounded-xl border border-input bg-secondary pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-64"
                />
              </div>
              <Button
                variant="outline"
                onClick={downloadHistoryCsv}
                disabled={filteredHistory.length === 0}
                className="rounded-xl text-xs"
              >
                <Download className="h-4 w-4" />
                Download report
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Payment ID</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredHistory.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-secondary">
                    <td className="px-5 py-3.5 font-mono text-xs text-foreground">
                      {row.id}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-foreground">
                      {money(row.amount_cents, row.currency)}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {new Date(row.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
