CREATE INDEX IF NOT EXISTS transactions_customer_email_idx
  ON public.transactions (lower(customer_email));

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    ''
  ));
$$;

CREATE POLICY "Customers can view own transactions by email"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  public.current_user_email() <> ''
  AND lower(customer_email) = public.current_user_email()
);

CREATE POLICY "Customers can update own transactions by email"
ON public.transactions
FOR UPDATE
TO authenticated
USING (
  public.current_user_email() <> ''
  AND lower(customer_email) = public.current_user_email()
)
WITH CHECK (
  public.current_user_email() <> ''
  AND lower(customer_email) = public.current_user_email()
);

CREATE POLICY "Customers can view analyses for own transactions"
ON public.ai_analyses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = ai_analyses.transaction_id
      AND public.current_user_email() <> ''
      AND lower(t.customer_email) = public.current_user_email()
  )
);