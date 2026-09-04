ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_phone_e164 TEXT;