-- Delete all message-related data
DELETE FROM public.message_read_receipts;
DELETE FROM public.message_reactions;
DELETE FROM public.message_translations;
DELETE FROM public.messages;