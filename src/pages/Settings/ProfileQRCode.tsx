import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode.react";

const FUNCTION_BASE = (import.meta as any)?.env?.VITE_FUNCTION_BASE || "/functions/v1";
const PUBLIC_APP_URL = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL || window.location.origin;

export default function ProfileQRCode() {
  const { toast } = useToast();
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Fetch the user’s invite link when the page loads
  useEffect(() => {
    generateInvite();
  }, []);

  const generateInvite = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      // Attempt to get the logged-in user ID (Lovable uses the same Supabase-style auth)
      const userRaw = localStorage.getItem("currentUser");
      const user = userRaw ? JSON.parse(userRaw) : null;
      const inviterId = user?.id;

      if (!inviterId) {
        setErrorMsg("User not authenticated. Please sign in.");
        setLoading(false);
        return;
      }

      const res = await fetch(`${FUNCTION_BASE}/create-qr-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviterId,
          ttlHours: 24,
          maxUses: 5,
          baseUrl: PUBLIC_APP_URL, // required by function
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`create-qr-invite failed (${res.status}): ${text}`);
      }

      const data = await res.json();
      if (!data?.inviteUrl) throw new Error("No inviteUrl returned from API");
      setInviteUrl(data.inviteUrl);
    } catch (err: any) {
      console.error("QR generation error:", err);
      setErrorMsg(err.message || "Failed to generate QR invite");
      toast({
        title: "Error",
        description: err.message || "Could not create QR code invite",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    toast({ title: "Copied", description: "Invite link copied to clipboard" });
  };

  const shareLink = async () => {
    if (!inviteUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Link Invite",
          text: "Join my chat instantly:",
          url: inviteUrl,
        });
      } else {
        copyLink();
      }
    } catch {
      copyLink();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <h2 className="text-lg font-semibold">Your QR Invite</h2>

      {loading && <div className="text-sm text-muted-foreground">Generating QR…</div>}
      {errorMsg && <div className="text-sm text-red-500">{errorMsg}</div>}

      {!loading && !errorMsg && inviteUrl && (
        <>
          <QRCode value={inviteUrl} size={220} />
          <p className="text-xs text-muted-foreground break-all max-w-[90%] text-center">{inviteUrl}</p>

          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={copyLink}>
              Copy Link
            </Button>
            <Button onClick={shareLink}>Share</Button>
          </div>

          <p className="text-[12px] text-muted-foreground text-center mt-4">
            Anyone can scan this QR to start a temporary chat with you.
          </p>
        </>
      )}
    </div>
  );
}
