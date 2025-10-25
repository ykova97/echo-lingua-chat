-- Drop the restrictive policy that blocks all access
DROP POLICY IF EXISTS "rate_limits_no_access" ON public.qr_rate_limits;

-- No need for RLS since only service role can access this table through functions
-- Service role bypasses RLS anyway
ALTER TABLE public.qr_rate_limits DISABLE ROW LEVEL SECURITY;