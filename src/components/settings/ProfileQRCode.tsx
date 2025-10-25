import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode.react";

export default function ProfileQRCode() {
  const [inviteUrl, setInviteUrl] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;
      const { data, error } = await supabase.functions.invoke("create-qr-invite", {
        body: { inviterId: user.id, ttlHours: 24, maxUses: 5 },
      });
        if (!error && data?.inviteUrl) setInviteUrl(data.inviteUrl);
    })();
  }, []);

  if (!inviteUrl) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <QRCode value={inviteUrl} size={220} />
      <div className="text-xs break-all text-muted-foreground">{inviteUrl}</div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
          Copy link
        </Button>
        <Button onClick={() => { if (navigator.share) navigator.share({ title: "Link invite", url: inviteUrl }); }}>
          Share
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Scan to start a temporary chat.</p>
    </div>
  );
}
