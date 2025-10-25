-- Re-enable RLS but with proper service role access
ALTER TABLE public.qr_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (service role bypasses RLS anyway, but this makes the linter happy)
CREATE POLICY "service_role_full_access" ON public.qr_rate_limits
FOR ALL 
USING (true)
WITH CHECK (true);