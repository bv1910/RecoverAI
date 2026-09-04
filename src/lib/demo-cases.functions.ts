import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEMO_CASES = [
  {
    amount_cents: 12900,
    currency: "USD",
    failure_code: "insufficient_funds",
    failure_reason: "Card declined — insufficient funds",
    payment_method: "card",
    attempts: 1,
  },
  {
    amount_cents: 45900,
    currency: "USD",
    failure_code: "expired_card",
    failure_reason: "Card expired",
    payment_method: "card",
    attempts: 2,
  },
  {
    amount_cents: 7500,
    currency: "USD",
    failure_code: "do_not_honor",
    failure_reason: "Issuer declined — do not honor",
    payment_method: "card",
    attempts: 1,
  },
  {
    amount_cents: 21900,
    currency: "USD",
    failure_code: "processor_error",
    failure_reason: "Temporary processor error",
    payment_method: "upi",
    attempts: 3,
  },
];

export const loadDemoCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const userEmail = String(claims?.email ?? "");
    if (!userEmail) throw new Error("Unauthorized: no email on session");

    const customerName = String(
      claims?.["full_name"] ?? userEmail.split("@")[0] ?? "Demo customer",
    );

    const { data: existing, error: existingError } = await supabase
      .from("transactions")
      .select("id")
      .ilike("customer_email", userEmail)
      .in("status", ["failed", "in_progress", "escalated"]);

    if (existingError) throw new Error(existingError.message);
    if ((existing?.length ?? 0) > 0) {
      return { created: 0, message: "You already have open cases." };
    }

    const now = Date.now();
    const rows = DEMO_CASES.map((c, i) => ({
      ...c,
      merchant_id: userId,
      customer_name: customerName,
      customer_email: userEmail,
      status: "failed",
      failed_at: new Date(now - (i + 1) * 36e5).toISOString(),
    }));

    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert(rows)
      .select("id");

    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "load_demo_cases",
      status: "success",
      details: { created: inserted?.length ?? 0 },
    });

    return {
      created: inserted?.length ?? 0,
      message: `Loaded ${inserted?.length ?? 0} demo cases.`,
    };
  });
