#!/usr/bin/env bash
set -euo pipefail
BRANCH="qr-chat-feature"
git checkout -b "$BRANCH" || git switch -c "$BRANCH"
git add supabase/functions/create-qr-invite/index.ts         supabase/functions/accept-qr-invite/index.ts         supabase/functions/guest-close/index.ts         supabase/functions/cleanup-ephemeral-chats/index.ts         src/components/settings/ProfileQRCode.tsx         src/pages/GuestJoin.tsx         src/pages/GuestChat.tsx         supabase/config.append.toml || true
git commit -m "feat(qr-guest-chat): add QR invites, guest chat pages, cleanup cron, and profile QR component" || true
git push -u origin "$BRANCH" || true
echo "Open a PR for branch $BRANCH."
