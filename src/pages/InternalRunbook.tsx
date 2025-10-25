import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InternalRunbook() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/chat-list")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Link – QR Chat Troubleshooting & Runbook (Internal)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold mb-4">1) Environment Variables – Quick Checks</h2>
              <div className="space-y-2 pl-4">
                <div className="flex items-start gap-2">
                  <Checkbox id="check-1" />
                  <label htmlFor="check-1" className="text-sm">
                    <code className="bg-muted px-1 py-0.5 rounded">LOVABLE_URL</code> is set (no trailing slash)
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="check-2" />
                  <label htmlFor="check-2" className="text-sm">
                    <code className="bg-muted px-1 py-0.5 rounded">PUBLIC_APP_URL</code> matches the live domain (no trailing slash)
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="check-3" />
                  <label htmlFor="check-3" className="text-sm">
                    <code className="bg-muted px-1 py-0.5 rounded">LOVABLE_SERVICE_KEY</code> is non-empty (server-only secret)
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="check-4" />
                  <label htmlFor="check-4" className="text-sm">
                    <code className="bg-muted px-1 py-0.5 rounded">LOVABLE_JWT_SECRET</code> is a strong random string (≥ 32 chars)
                  </label>
                </div>
                <div className="flex items-start gap-2 ml-4">
                  <span className="text-sm font-medium">Compatibility vars (if used by functions/frontend):</span>
                </div>
                <div className="flex items-start gap-2 ml-8">
                  <Checkbox id="check-5" />
                  <label htmlFor="check-5" className="text-sm">
                    <code className="bg-muted px-1 py-0.5 rounded">SUPABASE_URL = $&#123;LOVABLE_URL&#125;</code>
                  </label>
                </div>
                <div className="flex items-start gap-2 ml-8">
                  <Checkbox id="check-6" />
                  <label htmlFor="check-6" className="text-sm">
                    <code className="bg-muted px-1 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY = $&#123;LOVABLE_SERVICE_KEY&#125;</code>
                  </label>
                </div>
                <div className="flex items-start gap-2 ml-8">
                  <Checkbox id="check-7" />
                  <label htmlFor="check-7" className="text-sm">
                    <code className="bg-muted px-1 py-0.5 rounded">SUPABASE_JWT_SECRET = $&#123;LOVABLE_JWT_SECRET&#125;</code>
                  </label>
                </div>
                <div className="flex items-start gap-2 ml-8">
                  <Checkbox id="check-8" />
                  <label htmlFor="check-8" className="text-sm">
                    <code className="bg-muted px-1 py-0.5 rounded">VITE_SUPABASE_URL = $&#123;LOVABLE_URL&#125;</code>
                  </label>
                </div>
                <div className="flex items-start gap-2 ml-8">
                  <Checkbox id="check-9" />
                  <label htmlFor="check-9" className="text-sm">
                    <code className="bg-muted px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY = $&#123;LOVABLE_SERVICE_KEY&#125;</code>
                  </label>
                </div>
              </div>
              <p className="mt-4 text-sm bg-muted p-3 rounded">
                <strong>Fix:</strong> If any are missing or blank, set them, then redeploy app + all functions.
              </p>
            </section>

            <hr className="border-border" />

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-semibold mb-4">2) Edge Functions – Health Checks</h2>
              <p className="text-sm mb-2">Functions:</p>
              <ul className="list-disc pl-8 space-y-1 text-sm">
                <li><code className="bg-muted px-1 py-0.5 rounded">create-qr-invite</code></li>
                <li><code className="bg-muted px-1 py-0.5 rounded">accept-qr-invite</code></li>
                <li><code className="bg-muted px-1 py-0.5 rounded">guest-close</code></li>
                <li><code className="bg-muted px-1 py-0.5 rounded">cleanup-ephemeral-chats</code></li>
              </ul>
              <p className="mt-4 text-sm">
                <strong>Expected:</strong> Each returns HTTP 200 and valid JSON.
              </p>
              <div className="mt-4 bg-muted p-4 rounded overflow-x-auto">
                <p className="text-sm font-semibold mb-2">Quick test (cURL):</p>
                <pre className="text-xs">
{`FUNCTIONS_URL="https://<YOUR-PROJECT>.lovable.dev/functions/v1"

# 1) create-qr-invite
curl -s -X POST "$FUNCTIONS_URL/create-qr-invite" -H "Content-Type: application/json" \\
  -d '{"inviterId":"<YOUR_USER_UUID>","ttlHours":24,"maxUses":5}'

# 2) accept-qr-invite
curl -s -X POST "$FUNCTIONS_URL/accept-qr-invite" -H "Content-Type: application/json" \\
  -d '{"token":"<TOKEN_FROM_STEP_1>","name":"Guest Tester","preferredLanguage":"en"}'

# 3) guest-close
curl -s -X POST "$FUNCTIONS_URL/guest-close" -H "Content-Type: application/json" \\
  -d '{"chatId":"<CHAT_ID>","minutes":5}'

# 4) cleanup-ephemeral-chats (manual)
curl -s -X POST "$FUNCTIONS_URL/cleanup-ephemeral-chats" -H "Content-Type: application/json" -d '{}'`}
                </pre>
              </div>
            </section>

            <hr className="border-border" />

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-semibold mb-4">3) Database Schema – Critical Tables</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm mb-2"><code className="bg-muted px-1 py-0.5 rounded">guest_invites</code></h3>
                  <ul className="list-disc pl-8 space-y-1 text-sm">
                    <li>Stores QR invite tokens</li>
                    <li>Fields: <code className="bg-muted px-1 py-0.5 rounded">token</code>, <code className="bg-muted px-1 py-0.5 rounded">inviter_id</code>, <code className="bg-muted px-1 py-0.5 rounded">expires_at</code>, <code className="bg-muted px-1 py-0.5 rounded">max_uses</code>, <code className="bg-muted px-1 py-0.5 rounded">used_count</code></li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-2"><code className="bg-muted px-1 py-0.5 rounded">guest_sessions</code></h3>
                  <ul className="list-disc pl-8 space-y-1 text-sm">
                    <li>Tracks each guest who accepts an invite</li>
                    <li>Fields: <code className="bg-muted px-1 py-0.5 rounded">invite_id</code>, <code className="bg-muted px-1 py-0.5 rounded">display_name</code>, <code className="bg-muted px-1 py-0.5 rounded">preferred_language</code>, <code className="bg-muted px-1 py-0.5 rounded">expires_at</code></li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-2"><code className="bg-muted px-1 py-0.5 rounded">chats</code></h3>
                  <ul className="list-disc pl-8 space-y-1 text-sm">
                    <li>Ephemeral chats have <code className="bg-muted px-1 py-0.5 rounded">is_ephemeral = true</code> and <code className="bg-muted px-1 py-0.5 rounded">delete_after</code> timestamp</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-2"><code className="bg-muted px-1 py-0.5 rounded">chat_participants</code></h3>
                  <ul className="list-disc pl-8 space-y-1 text-sm">
                    <li>Links users + guests to chats</li>
                    <li>Note: No FK to profiles (guests use random UUIDs)</li>
                  </ul>
                </div>
              </div>
            </section>

            <hr className="border-border" />

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-semibold mb-4">4) Common Issues & Fixes</h2>
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded">
                  <h3 className="font-semibold text-sm mb-2">❌ "Key length is zero" error</h3>
                  <p className="text-sm mb-2"><strong>Cause:</strong> JWT secret is empty or not accessible to edge function.</p>
                  <p className="text-sm"><strong>Fix:</strong> Ensure <code className="bg-background px-1 py-0.5 rounded">GUEST_JWT_SECRET</code> or fallback to <code className="bg-background px-1 py-0.5 rounded">SUPABASE_ANON_KEY</code> is set in function env.</p>
                </div>
                <div className="bg-muted p-4 rounded">
                  <h3 className="font-semibold text-sm mb-2">❌ "PUBLIC_APP_URL" appears as literal text in invite link</h3>
                  <p className="text-sm mb-2"><strong>Cause:</strong> Environment variable not replaced during build.</p>
                  <p className="text-sm"><strong>Fix:</strong> Set actual domain in <code className="bg-background px-1 py-0.5 rounded">PUBLIC_APP_URL</code> secret, redeploy functions.</p>
                </div>
                <div className="bg-muted p-4 rounded">
                  <h3 className="font-semibold text-sm mb-2">❌ Guest messages missing <code className="bg-background px-1 py-0.5 rounded">sender_id</code></h3>
                  <p className="text-sm mb-2"><strong>Cause:</strong> Frontend doesn't include guest UUID when inserting message.</p>
                  <p className="text-sm"><strong>Fix:</strong> Use <code className="bg-background px-1 py-0.5 rounded">sessionStorage.getItem("guestChatId")</code> as sender_id in GuestChat.tsx.</p>
                </div>
                <div className="bg-muted p-4 rounded">
                  <h3 className="font-semibold text-sm mb-2">❌ Cleanup job doesn't run</h3>
                  <p className="text-sm mb-2"><strong>Cause:</strong> Cron schedule not enabled in <code className="bg-background px-1 py-0.5 rounded">supabase/config.toml</code>.</p>
                  <p className="text-sm"><strong>Fix:</strong> Verify schedule block exists for <code className="bg-background px-1 py-0.5 rounded">cleanup-ephemeral-chats</code> with <code className="bg-background px-1 py-0.5 rounded">cron = "*/15 * * * *"</code>.</p>
                </div>
              </div>
            </section>

            <hr className="border-border" />

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-semibold mb-4">5) Manual Cleanup Test</h2>
              <p className="text-sm mb-2">To verify ephemeral chat cleanup works:</p>
              <ol className="list-decimal pl-8 space-y-2 text-sm">
                <li>Create a test guest invite and accept it</li>
                <li>Send a test message in the ephemeral chat</li>
                <li>Call <code className="bg-muted px-1 py-0.5 rounded">guest-close</code> with <code className="bg-muted px-1 py-0.5 rounded">minutes: 0</code> to set immediate deletion</li>
                <li>Manually invoke <code className="bg-muted px-1 py-0.5 rounded">cleanup-ephemeral-chats</code></li>
                <li>Verify chat + messages are deleted from database</li>
              </ol>
              <div className="mt-4 bg-muted p-4 rounded overflow-x-auto">
                <pre className="text-xs">
{`# Example: immediate cleanup test
curl -X POST "https://<PROJECT>.lovable.dev/functions/v1/guest-close" \\
  -H "Content-Type: application/json" \\
  -d '{"chatId":"<CHAT_UUID>","minutes":0}'

# Wait 1 second, then trigger cleanup
curl -X POST "https://<PROJECT>.lovable.dev/functions/v1/cleanup-ephemeral-chats" \\
  -H "Content-Type: application/json" -d '{}'`}
                </pre>
              </div>
            </section>

            <div className="pt-4 text-xs text-muted-foreground text-center">
              Internal documentation – Link messenger v1.0
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
