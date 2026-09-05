import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OnboardingStatus = {
  onboarded: boolean;
  businessName: string;
  businessWebsite: string;
  currency: string;
  ownTransactions: number;
};

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingStatus> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name, business_website, default_currency, onboarded_at")
      .eq("id", userId)
      .maybeSingle();

    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", userId);

    return {
      onboarded: Boolean(profile?.onboarded_at),
      businessName: profile?.business_name ?? "",
      businessWebsite: profile?.business_website ?? "",
      currency: profile?.default_currency ?? "USD",
      ownTransactions: count ?? 0,
    };
  });

type OnboardingInput = {
  businessName: string;
  businessWebsite: string;
  currency: string;
  customerName: string;
  customerEmail: string;
  amountCents: number;
  failureCode: string;
  failureReason: string;
  paymentMethod: string;
};

const FAILURE_REASONS: Record<string, string> = {
  insufficient_funds: "Card declined — insufficient funds",
  expired_card: "Card expired",
  do_not_honor: "Issuer declined — do not honor",
  processor_error: "Temporary processor error",
  authentication_required: "3D Secure authentication not completed",
  unknown: "Payment failed",
};

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OnboardingInput) => {
    const businessName = String(input.businessName ?? "").trim();
    const customerName = String(input.customerName ?? "").trim();
    const customerEmail = String(input.customerEmail ?? "").trim().toLowerCase();
    const amountCents = Math.round(Number(input.amountCents));

    if (businessName.length < 2) throw new Error("Enter your business name.");
    if (customerName.length < 2) throw new Error("Enter the customer's name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
      throw new Error("Enter a valid customer email.");
    }
    if (!Number.isFinite(amountCents) || amountCents < 50) {
      throw new Error("Enter an amount of at least 0.50.");
    }

    const failureCode = String(input.failureCode ?? "unknown");

    return {
      businessName,
      businessWebsite: String(input.businessWebsite ?? "").trim(),
      currency: (String(input.currency ?? "USD").toUpperCase() || "USD").slice(0, 3),
      customerName,
      customerEmail,
      amountCents,
      failureCode,
      failureReason:
        String(input.failureReason ?? "").trim() ||
        FAILURE_REASONS[failureCode] ||
        FAILURE_REASONS['unknown']!,
      paymentMethod: String(input.paymentMethod ?? "card"),
    } satisfies OnboardingInput;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = String(claims?.email ?? "");

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: data.businessName,
        role: "merchant",
        business_name: data.businessName,
        business_website: data.businessWebsite,
        default_currency: data.currency,
        onboarded_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (profileError) throw new Error(profileError.message);

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        merchant_id: userId,
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        amount_cents: data.amountCents,
        currency: data.currency,
        status: "failed",
        failure_code: data.failureCode,
        failure_reason: data.failureReason,
        payment_method: data.paymentMethod,
        attempts: 1,
        failed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (txError) throw new Error(txError.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      transaction_id: transaction.id,
      action: "merchant_onboarded",
      status: "success",
      details: { business_name: data.businessName, first_transaction: transaction.id },
    });

    return { transactionId: transaction.id as string };
  });
