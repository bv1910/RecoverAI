import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const retryCustomerPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    const userEmail = String(claims?.email ?? "");
    if (!userEmail) {
      throw new Error("Unauthorized: no email on session");
    }

    const { data: tx, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!tx) throw new Error("Payment not found");

    if (tx.customer_email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new Error("Unauthorized");
    }

    if (tx.status === "recovered") {
      return { status: "recovered", attempts: tx.attempts };
    }

    const attempts = tx.attempts + 1;
    const soft = ["insufficient_funds", "processor_error", "do_not_honor"].includes(tx.failure_code);
    const nextStatus = soft && attempts <= 4 ? "recovered" : "in_progress";

    const { error: updateError } = await supabase
      .from("transactions")
      .update({ status: nextStatus, attempts })
      .eq("id", tx.id);

    if (updateError) throw new Error(updateError.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      transaction_id: tx.id,
      action: "customer_retry",
      status: "success",
      details: {
        outcome:
          nextStatus === "recovered"
            ? "Payment recovered by customer"
            : "Customer retry attempted",
        previous_status: tx.status,
        new_status: nextStatus,
        attempts,
      },
    });

    return { status: nextStatus, attempts };
  });
