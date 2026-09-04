CREATE TABLE public.recovery_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'razorpay',
  order_id text NOT NULL,
  payment_id text,
  signature text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX recovery_payments_order_id_key ON public.recovery_payments(order_id);
CREATE INDEX recovery_payments_transaction_id_idx ON public.recovery_payments(transaction_id);

GRANT SELECT ON public.recovery_payments TO authenticated;
GRANT ALL ON public.recovery_payments TO service_role;

ALTER TABLE public.recovery_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recovery payments"
ON public.recovery_payments FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = recovery_payments.transaction_id
      AND (t.merchant_id = auth.uid() OR t.merchant_id IS NULL)
  )
);

CREATE TRIGGER update_recovery_payments_updated_at
BEFORE UPDATE ON public.recovery_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();