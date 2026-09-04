import { createServerFn } from "@tanstack/react-start";
import { createHmac, timingSafeEqual } from "crypto";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Razorpay test-mode integration.
 * The key secret is only ever read inside these handlers and never returned
 * to the browser. The key id is publishable and is required by Checkout.
 */

type Creds = { keyId: string; keySecret: string };

function readCreds(): Creds {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured yet. Add your test Key ID and Key Secret.",
    );
  }
  return { keyId, keySecret };
}

async function loadOwnedTransaction(
  supabase: any,
  transactionId: string,
  userEmail: string,
) {
  const { data: tx, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!tx) throw new Error("Payment not found");
  if (String(tx.customer_email).toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error("Unauthorized");
  }
  return tx;
}

/** Creates a Razorpay order server-side and records it in the database. */
export const createRecoveryOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string }) => {
    if (!data?.transactionId) throw new Error("transactionId is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const userEmail = String(claims?.email ?? "");
    if (!userEmail) throw new Error("Unauthorized: no email on session");

    const { keyId, keySecret } = readCreds();
    const tx = await loadOwnedTransaction(supabase, data.transactionId, userEmail);

    if (tx.status === "recovered") {
      throw new Error("This payment has already been completed.");
    }

    const amount = Math.max(100, Math.round(tx.amount_cents));
    const currency = "INR";

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt: `rec_${String(tx.id).slice(0, 30)}`,
        notes: { transaction_id: tx.id, customer_email: tx.customer_email },
      }),
    });

    const payload = (await res.json()) as any;
    if (!res.ok) {
      const message =
        payload?.error?.description ?? "Could not create the payment order.";
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: userId,
        transaction_id: tx.id,
        action: "razorpay_order_failed",
        status: "error",
        details: { message },
      });
      throw new Error(message);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insertError } = await supabaseAdmin
      .from("recovery_payments")
      .insert({
        transaction_id: tx.id,
        user_id: userId,
        provider: "razorpay",
        order_id: payload.id,
        amount_cents: amount,
        currency,
        status: "created",
      });
    if (insertError) throw new Error(insertError.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      transaction_id: tx.id,
      action: "razorpay_order_created",
      status: "success",
      details: { order_id: payload.id, amount_cents: amount, currency },
    });

    return {
      orderId: payload.id as string,
      amount,
      currency,
      keyId, // publishable Razorpay key id, safe in the browser
      customerName: tx.customer_name as string,
      customerEmail: tx.customer_email as string,
    };
  });

/** Verifies the Razorpay signature server-side and records the outcome. */
export const verifyRecoveryPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      transactionId: string;
      orderId: string;
      paymentId: string;
      signature: string;
    }) => {
      if (!data?.transactionId || !data?.orderId || !data?.paymentId || !data?.signature) {
        throw new Error("Missing payment verification fields");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const userEmail = String(claims?.email ?? "");
    if (!userEmail) throw new Error("Unauthorized: no email on session");

    const { keySecret } = readCreds();
    const tx = await loadOwnedTransaction(supabase, data.transactionId, userEmail);

    const expected = createHmac("sha256", keySecret)
      .update(`${data.orderId}|${data.paymentId}`)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(data.signature);
    const valid = a.length === b.length && timingSafeEqual(a, b);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!valid) {
      await supabaseAdmin
        .from("recovery_payments")
        .update({ status: "failed", error_message: "Signature verification failed" })
        .eq("order_id", data.orderId);

      await supabaseAdmin.from("audit_logs").insert({
        actor_id: userId,
        transaction_id: tx.id,
        action: "razorpay_verification_failed",
        status: "error",
        details: { order_id: data.orderId, payment_id: data.paymentId },
      });

      throw new Error("Payment verification failed. You have not been charged.");
    }

    const attempts = tx.attempts + 1;

    await supabaseAdmin
      .from("recovery_payments")
      .update({
        status: "paid",
        payment_id: data.paymentId,
        signature: data.signature,
        error_message: null,
      })
      .eq("order_id", data.orderId);

    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .update({ status: "recovered", attempts })
      .eq("id", tx.id);
    if (txError) throw new Error(txError.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      transaction_id: tx.id,
      action: "razorpay_payment_verified",
      status: "success",
      details: {
        order_id: data.orderId,
        payment_id: data.paymentId,
        previous_status: tx.status,
        new_status: "recovered",
        attempts,
      },
    });

    return { status: "recovered" as const, attempts, paymentId: data.paymentId };
  });
