import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput, toE164 } from "@/components/phone-input";
import { DEFAULT_COUNTRY } from "@/lib/countries";

export const Route = createFileRoute("/pay")({
  head: () => ({
    meta: [
      { title: "Customer Payment — RecoverAI" },
      {
        name: "description",
        content:
          "Demo payment page where a customer enters their name, phone number and amount to complete a simulated payment.",
      },
      { property: "og:title", content: "Customer Payment — RecoverAI" },
      {
        property: "og:description",
        content:
          "Enter your name, phone number and amount to complete a simulated RecoverAI payment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerPaymentPage,
});

type Receipt = {
  reference: string;
  name: string;
  phone: string;
  amount: number;
  paidAt: string;
};

function CustomerPaymentPage() {
  const [name, setName] = useState("");
  const [country, setCountry] = useState<CountryCode>(
    DEFAULT_COUNTRY as CountryCode,
  );
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const handlePay = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    const e164 = toE164(phone, country);
    if (!e164) {
      setError("Please enter a valid phone number for the selected country.");
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Please enter an amount greater than zero.");
      return;
    }

    setPaying(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setPaying(false);
    setReceipt({
      reference: `sim_${Math.random().toString(36).slice(2, 10)}`,
      name: name.trim(),
      phone: e164,
      amount: value,
      paidAt: new Date().toLocaleString(),
    });
  };

  const reset = () => {
    setReceipt(null);
    setName("");
    setPhone("");
    setAmount("");
  };

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-xl items-center gap-2.5 px-5 py-4">
          <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-brand-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-foreground">
              RecoverAI
            </p>
            <p className="text-xs text-muted-foreground">Customer payment</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-10">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
          {receipt ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <h1 className="mt-4 text-2xl font-semibold text-foreground">
                Payment successful
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This is a demo payment — no money was moved.
              </p>
              <dl className="mt-6 space-y-3 rounded-xl border border-border bg-secondary p-5 text-left text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="font-medium text-foreground">
                    {receipt.reference}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium text-foreground">{receipt.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-medium text-foreground">{receipt.phone}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="font-medium text-foreground">
                    {receipt.amount.toFixed(2)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Paid at</dt>
                  <dd className="font-medium text-foreground">
                    {receipt.paidAt}
                  </dd>
                </div>
              </dl>
              <Button
                variant="outline"
                onClick={reset}
                className="mt-6 rounded-xl"
              >
                Make another payment
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-foreground">
                Make a payment
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your details below. This is a demo flow — no real payment
                is processed.
              </p>

              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="pay-name">Full name</Label>
                  <Input
                    id="pay-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nandini Sharma"
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pay-phone">Phone number</Label>
                  <PhoneInput
                    id="pay-phone"
                    country={country}
                    onCountryChange={setCountry}
                    value={phone}
                    onValueChange={setPhone}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pay-amount">Amount</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="499.00"
                    className="h-12 rounded-xl"
                  />
                </div>

                {error ? (
                  <p className="text-sm font-medium text-destructive">{error}</p>
                ) : null}

                <Button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full rounded-xl text-sm font-semibold"
                >
                  {paying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    "Pay Now"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
