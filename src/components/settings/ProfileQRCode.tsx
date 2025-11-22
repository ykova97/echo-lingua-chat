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
  const [generatingLink, setGeneratingLink] = useState(false);
  const { toast } = useToast();

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

      const baseUrl = ORIGIN;
      console.log("Generating QR with baseUrl:", baseUrl);
      console.log("Current window.location.origin:", window.location.origin);

      // Call the edge function to create the invite
      const res = await fetch(`${BASE}/create-qr-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          inviterId: user.id, 
          ttlHours: 24, 
          maxUses: 5,
          baseUrl
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

  const handleGenerateShareLink = async () => {
    try {
      setGeneratingLink(true);
      const result = await generateShareLink();
      
      toast({
        title: "Share link generated!",
        description: "Link copied to clipboard",
      });
      
      // Copy to clipboard
      await navigator.clipboard.writeText(result.share_url);
      
      // Also update the QR code with this link
      setInviteUrl(result.share_url);
    } catch (err: any) {
      toast({
        title: "Failed to generate link",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setGeneratingLink(false);
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
          variant="outline"
          onClick={handleGenerateShareLink}
          disabled={generatingLink}
        >
          {generatingLink ? "Generating..." : "New Share Link"}
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
