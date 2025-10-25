# Link Update: QR Invite + Guest Chat + Cleanup

This package adds:
- Edge functions: `create-qr-invite`, `accept-qr-invite`, `guest-close`, `cleanup-ephemeral-chats`
- Frontend pages: `GuestJoin.tsx`, `GuestChat.tsx`
- Component: `ProfileQRCode.tsx`
- Config append: `supabase/config.append.toml`

## Env Vars
Set these in Lovable/Supabase:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_JWT_SECRET
- PUBLIC_APP_URL (e.g., https://your-app.com)

## Router
Add routes:
<Route path="/guest/:token" element={<GuestJoin />} />
<Route path="/guest-chat/:chatId" element={<GuestChat />} />

## Cron
Append the block from `supabase/config.append.toml` into your `supabase/config.toml`.
