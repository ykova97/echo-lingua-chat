-- Create rate limiting table for QR guest chats
CREATE TABLE public.qr_rate_limits (
  inviter_id uuid NOT NULL,
  minute_bucket timestamptz NOT NULL,
  count int NOT NULL DEFAULT 1,
  PRIMARY KEY (inviter_id, minute_bucket)
);

-- Enable RLS (no direct access needed, only through functions)
ALTER TABLE public.qr_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy to block all direct access
CREATE POLICY "rate_limits_no_access" ON public.qr_rate_limits
FOR ALL USING (false);

-- Create index for efficient cleanup of old buckets
CREATE INDEX idx_qr_rate_limits_minute_bucket ON public.qr_rate_limits(minute_bucket);

-- Function to clean up old rate limit entries (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.qr_rate_limits
  WHERE minute_bucket < NOW() - INTERVAL '5 minutes';
END;
$$;