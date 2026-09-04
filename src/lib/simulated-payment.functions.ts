import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Simulated recovery payment flow.
 * No external payment provider is used. All state changes happen server-side
 * after the caller's identity and ownership of the transaction are verified.
 */
export const simulateRecoveryPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string }) => {
    if (!data?.transactionId) throw new Error("transactionId is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const userEmail = String(claims?.email ?? "");
    if (!userEmail) throw new Error("Unauthorized: no email on session");

    const { data: tx, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!tx) throw new Error("Payment not found");
    if (String(tx.customer_email).toLowerCase() !== userEmail.toLowerCase()) {
      throw new Error("Unauthorized");
    }
    if (tx.status === "recovered") {
      throw new Error("This payment has already been completed.");
    }

    const amount = Math.max(0, Math.round(tx.amount_cents));
    const currency = String(tx.currency ?? "USD");
    const attempts = (tx.attempts ?? 0) + 1;
    const reference = `sim_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error: paymentError } = await supabaseAdmin
      .from("recovery_payments")
      .insert({
        transaction_id: tx.id,
        user_id: userId,
        provider: "simulated",
        order_id: reference,
        payment_id: reference,
        amount_cents: amount,
        currency,
        status: "paid",
      });
    if (paymentError) throw new Error(paymentError.message);

    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .update({ status: "recovered", attempts })
      .eq("id", tx.id);
    if (txError) throw new Error(txError.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      transaction_id: tx.id,
      action: "simulated_payment_recovered",
      status: "success",
      details: {
        reference,
        amount_cents: amount,
        currency,
        previous_status: tx.status,
        new_status: "recovered",
        attempts,
        simulated: true,
      },
    });

    return {
      status: "recovered" as const,
      attempts,
      reference,
      amountCents: amount,
      currency,
    };
  });
