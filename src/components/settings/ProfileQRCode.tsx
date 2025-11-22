import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { generateShareLink } from "@/lib/generateShareLink";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BASE = `${SUPABASE_URL}/functions/v1`;
// Extract Lovable project ID from current URL (works in preview and deployed)
const getLovableProjectUrl = () => {
  const currentOrigin = window.location.origin;
  // If already on lovableproject.com, use current origin
  if (currentOrigin.includes('.lovableproject.com')) {
    return currentOrigin;
  }
  // Fallback to extracting from preview URL pattern
  const match = currentOrigin.match(/https:\/\/([a-f0-9-]+)--/);
  if (match) {
    return `https://${match[1]}.lovableproject.com`;
  }
  return currentOrigin;
};
const ORIGIN = getLovableProjectUrl();

export default function ProfileQRCode() {
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const { toast } = useToast();

  const generateQRCode = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const result = await generateShareLink();
      setInviteUrl(result.share_url);
      
      toast({
        title: "Share link generated!",
        description: "QR code updated with new link",
      });
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to generate share link.");
      toast({
        title: "Failed to generate link",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
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
      <div className="flex gap-2 flex-wrap justify-center">
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
      <p className="text-xs text-muted-foreground">Scan to start a temporary chat. Share links expire in 24h with max 10 uses.</p>
    </div>
  );
}
