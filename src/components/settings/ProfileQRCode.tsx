import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BASE = `${SUPABASE_URL}/functions/v1`;
const ORIGIN = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL || window.location.origin;

export default function ProfileQRCode() {
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const generateQRCode = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      // Get current user from Supabase auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setErrorMsg("Please sign in to generate QR code.");
        setLoading(false);
        return;
      }

      // Call the edge function to create the invite
      const res = await fetch(`${BASE}/create-qr-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          inviterId: user.id, 
          ttlHours: 24, 
          maxUses: 5,
          baseUrl: ORIGIN
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to create invite");
      }
      
      const data = await res.json();
      if (data?.inviteUrl) {
        setInviteUrl(data.inviteUrl);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to create invite.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateQRCode();
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
        <Button variant="outline" onClick={generateQRCode} disabled={loading}>
          {loading ? "Regenerating..." : "Regenerate"}
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
