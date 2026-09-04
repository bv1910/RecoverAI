import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RecoveryAnalysis = {
  transaction_id: string;
  root_cause: string;
  recovery_probability: number;
  recommended_action: string;
  rationale: string;
};

const ACTIONS = ["retry_payment", "create_payment_link", "send_reminder", "escalate"] as const;

const FALLBACK: Record<string, { cause: string; probability: number; action: string }> = {
  insufficient_funds: {
    cause: "Balance shortfall at the time of capture — the card itself is valid.",
    probability: 72,
    action: "retry_payment",
  },
  expired_card: {
    cause: "Stored card credentials have passed their expiry date.",
    probability: 64,
    action: "create_payment_link",
  },
  authentication_required: {
    cause: "The 3-D Secure challenge was never completed by the customer.",
    probability: 58,
    action: "send_reminder",
  },
  do_not_honor: {
    cause: "Issuer-side soft decline with no specific reason returned.",
    probability: 41,
    action: "create_payment_link",
  },
  processor_error: {
    cause: "Transient gateway failure during capture, not a customer problem.",
    probability: 81,
    action: "retry_payment",
  },
  fraud_suspected: {
    cause: "Risk engine flagged the payment and blocked settlement.",
    probability: 18,
    action: "escalate",
  },
};

function fallbackFor(failureCode: string, attempts: number) {
  const base = FALLBACK[failureCode] ?? {
    cause: "Decline reason could not be classified from the gateway response.",
    probability: 45,
    action: "send_reminder",
  };
  return {
    root_cause: base.cause,
    recovery_probability: Math.max(5, base.probability - (attempts - 1) * 8),
    recommended_action: base.action,
    rationale: "Generated from RecoverAI's decline playbook while the model was unavailable.",
  };
}

export const analyzeTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string }) => data)
  .handler(async ({ data, context }): Promise<RecoveryAnalysis> => {
    const { supabase, userId } = context;

    const { data: tx, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!tx) throw new Error("Case not found");

    let result = fallbackFor(tx.failure_code, tx.attempts);

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (apiKey) {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.7-flash",
            messages: [
              {
                role: "system",
                content:
                  "You are RecoverAI's payment recovery analyst. Reply with strict JSON only: " +
                  '{"root_cause": string, "recovery_probability": number 0-100, "recommended_action": one of ' +
                  `${ACTIONS.join("|")}, "rationale": string}. Keep root_cause under 200 characters and rationale under 300.`,
              },
              {
                role: "user",
                content: JSON.stringify({
                  amount: tx.amount_cents / 100,
                  currency: tx.currency,
                  failure_code: tx.failure_code,
                  failure_reason: tx.failure_reason,
                  payment_method: tx.payment_method,
                  attempts: tx.attempts,
                  status: tx.status,
                  failed_at: tx.failed_at,
                }),
              },
            ],
          }),
        });

        if (response.ok) {
          const payload = (await response.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const raw = payload.choices?.[0]?.message?.content ?? "";
          const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
          const parsed = JSON.parse(json) as Partial<RecoveryAnalysis>;
          const action = String(parsed.recommended_action ?? "");
          result = {
            root_cause: String(parsed.root_cause ?? result.root_cause),
            recovery_probability: Math.min(
              100,
              Math.max(0, Math.round(Number(parsed.recovery_probability ?? result.recovery_probability))),
            ),
            recommended_action: (ACTIONS as readonly string[]).includes(action)
              ? action
              : result.recommended_action,
            rationale: String(parsed.rationale ?? result.rationale),
          };
        }
      } catch {
        // keep playbook fallback
      }
    }

    const { data: existing } = await supabase
      .from("ai_analyses")
      .select("id")
      .eq("transaction_id", tx.id)
      .eq("merchant_id", userId)
      .maybeSingle();

    const row = {
      transaction_id: tx.id,
      merchant_id: userId,
      root_cause: result.root_cause,
      recovery_probability: result.recovery_probability,
      recommended_action: result.recommended_action,
      rationale: result.rationale,
    };

    if (existing) {
      await supabase.from("ai_analyses").update(row).eq("id", existing.id);
    } else {
      await supabase.from("ai_analyses").insert(row);
    }

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      transaction_id: tx.id,
      action: "ai_analysis",
      status: "success",
      details: {
        root_cause: result.root_cause,
        recovery_probability: result.recovery_probability,
        recommended_action: result.recommended_action,
      },
    });

    return { transaction_id: tx.id, ...result };
  });

export const runRecoveryAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string; action: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!(ACTIONS as readonly string[]).includes(data.action)) {
      throw new Error("Unsupported recovery action");
    }

    const { data: tx, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tx) throw new Error("Case not found");

    let nextStatus = tx.status;
    let attempts = tx.attempts;
    let outcome = "";

    switch (data.action) {
      case "retry_payment": {
        attempts = tx.attempts + 1;
        // Bounded simulation: soft declines settle, hard declines do not.
        const soft = ["insufficient_funds", "processor_error", "do_not_honor"].includes(
          tx.failure_code,
        );
        nextStatus = soft && attempts <= 4 ? "recovered" : "in_progress";
        outcome = nextStatus === "recovered" ? "Payment captured on retry" : "Retry queued with issuer";
        break;
      }
      case "create_payment_link":
        nextStatus = "in_progress";
        outcome = `Secure payment link sent to ${tx.customer_email}`;
        break;
      case "send_reminder":
        nextStatus = "in_progress";
        outcome = `Reminder emailed to ${tx.customer_email}`;
        break;
      case "escalate":
        nextStatus = "escalated";
        outcome = "Case escalated to the human recovery team";
        break;
    }

    const { error: updateError } = await supabase
      .from("transactions")
      .update({ status: nextStatus, attempts })
      .eq("id", tx.id);
    if (updateError) throw new Error(updateError.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      transaction_id: tx.id,
      action: data.action,
      status: "success",
      details: {
        outcome,
        previous_status: tx.status,
        new_status: nextStatus,
        amount_cents: tx.amount_cents,
        customer_email: tx.customer_email,
      },
    });

    return { status: nextStatus, outcome };
  });
