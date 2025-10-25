import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";

export default function ProfileQRCode() {
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
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
        const { data, error } = await supabase.functions.invoke('create-qr-invite', {
          body: { 
            inviterId: user.id, 
            ttlHours: 24, 
            maxUses: 5
          }
        });

        if (error) {
          throw new Error(error.message || "Failed to create invite");
        }
        
        if (data?.inviteUrl) {
          setInviteUrl(data.inviteUrl);
        }
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
