import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode.react";

// If Lovable hosts functions under a different base, change this:
const FUNCTION_BASE = "/functions/v1";

export default function ProfileQRCode() {
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        // Get current user from your auth source.
        // If you have a profile context, use that.
        // For now, try to read from local storage or a user endpoint if available.
        const raw = localStorage.getItem("currentUser");
        const user = raw ? JSON.parse(raw) : null;
        const inviterId = user?.id; // adjust to your actual user shape

        if (!inviterId) {
          setErrorMsg("User not loaded. Please sign in.");
          setLoading(false);
          return;
        }

        const res = await fetch(`${FUNCTION_BASE}/create-qr-invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviterId, ttlHours: 24, maxUses: 5 }),
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`create-qr-invite failed: ${res.status} ${t}`);
        }
        const data = await res.json();
        if (data?.inviteUrl) setInviteUrl(data.inviteUrl);
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to create invite.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">Generating QR…</div>;
  if (errorMsg) return <div className="text-sm text-red-500">{errorMsg}</div>;
  if (!inviteUrl) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <QRCode value={inviteUrl} size={220} />
      <div className="text-xs break-all text-muted-foreground">{inviteUrl}</div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
          Copy link
        </Button>
        <Button
          onClick={() => {
            if (navigator.share) navigator.share({ title: "Link invite", url: inviteUrl });
          }}
        >
          Share
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Scan to start a temporary chat.</p>
    </div>
  );
}
