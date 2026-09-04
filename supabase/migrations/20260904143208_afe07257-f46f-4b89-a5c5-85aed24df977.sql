INSERT INTO public.transactions (merchant_id, customer_name, customer_email, amount_cents, currency, status, failure_code, failure_reason, payment_method, attempts, failed_at)
VALUES
 (NULL,'Aarav Sharma','aarav@demo.recoverai',12900,'USD','failed','insufficient_funds','Card declined due to insufficient balance','card',2, now() - interval '2 hours'),
 (NULL,'Meera Patel','meera@demo.recoverai',45900,'USD','failed','expired_card','Card has expired','card',1, now() - interval '5 hours'),
 (NULL,'Rohan Gupta','rohan@demo.recoverai',7500,'USD','failed','do_not_honor','Issuer declined the transaction','card',3, now() - interval '9 hours'),
 (NULL,'Sara Khan','sara@demo.recoverai',21900,'USD','failed','processor_error','Temporary processor outage','upi',1, now() - interval '1 day'),
 (NULL,'Dev Mehta','dev@demo.recoverai',33500,'USD','in_progress','3ds_failed','3D Secure authentication not completed','card',2, now() - interval '3 days'),
 (NULL,'Nisha Rao','nisha@demo.recoverai',18900,'USD','recovered','insufficient_funds','Recovered after retry','card',2, now() - interval '4 days'),
 (NULL,'Kabir Singh','kabir@demo.recoverai',9900,'USD','recovered','processor_error','Recovered after retry','upi',2, now() - interval '6 days'),
 (NULL,'Ishita Bose','ishita@demo.recoverai',54000,'USD','recovered','do_not_honor','Recovered after customer updated card','card',3, now() - interval '8 days');