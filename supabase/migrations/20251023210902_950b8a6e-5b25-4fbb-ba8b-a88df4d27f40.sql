-- 1) Helpful indexes (safe if they already exist)
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat ON public.chat_participants (chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON public.chat_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_user ON public.chat_participants (chat_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_by ON public.chats (created_by);

-- 2) RPC: find_or_create_chat(participant_ids uuid[]) → uuid (chat_id)
--    - Exact set match (no more / no less)
--    - Requires auth.uid() to be included in participant_ids to prevent abuse
--    - Uses SECURITY DEFINER but *still* enforces that the caller is in the set

CREATE OR REPLACE FUNCTION public.find_or_create_chat(participant_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_ids uuid[];
  caller uuid := auth.uid();
  existing_chat uuid;
  new_chat uuid;
  participant uuid;
  distinct_count int;
BEGIN
  -- 1) Sanity: remove nulls & dedupe
  SELECT array_agg(DISTINCT x) INTO cleaned_ids
  FROM unnest(participant_ids) AS t(x)
  WHERE x IS NOT NULL;

  IF cleaned_ids IS NULL OR array_length(cleaned_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'participant_ids cannot be empty';
  END IF;

  -- 2) Require caller to be part of the set
  IF NOT caller = ANY (cleaned_ids) THEN
    RAISE EXCEPTION 'Caller must be included in participant_ids';
  END IF;

  -- 3) (Optional) Limit group size for safety
  IF array_length(cleaned_ids, 1) > 50 THEN
    RAISE EXCEPTION 'Too many participants';
  END IF;

  -- 4) Exact-set match:
  --    Find a chat where:
  --      - number of participants = array_length(cleaned_ids)
  --      - every participant in that chat is inside cleaned_ids
  SELECT c.id
  INTO existing_chat
  FROM public.chats c
  JOIN public.chat_participants cp ON cp.chat_id = c.id
  GROUP BY c.id
  HAVING COUNT(*) = array_length(cleaned_ids, 1)
     AND BOOL_AND(cp.user_id = ANY(cleaned_ids))
     AND -- also ensure every cleaned_id is present in the chat
         NOT EXISTS (
           SELECT 1
           FROM unnest(cleaned_ids) AS u(uid)
           LEFT JOIN public.chat_participants cp2 ON cp2.chat_id = c.id AND cp2.user_id = u.uid
           WHERE cp2.user_id IS NULL
         )
  LIMIT 1;

  IF existing_chat IS NOT NULL THEN
    RETURN existing_chat;
  END IF;

  -- 5) Create new chat
  INSERT INTO public.chats (type, name, created_by)
  VALUES (
    CASE WHEN array_length(cleaned_ids, 1) > 2 THEN 'group' ELSE 'direct' END,
    NULL, -- you can set a default name later if you want
    caller
  )
  RETURNING id INTO new_chat;

  -- 6) Add participants
  FOREACH participant IN ARRAY cleaned_ids LOOP
    INSERT INTO public.chat_participants (chat_id, user_id)
    VALUES (new_chat, participant)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN new_chat;
END;
$$;

-- 3) Restrict who can call the function (RLS still applies to base tables)
--    Supabase functions with SECURITY DEFINER bypass RLS, so we add a guard above (caller in set).
--    Optionally, you can also add grants if you use Postgres roles:
GRANT EXECUTE ON FUNCTION public.find_or_create_chat(uuid[]) TO authenticated;