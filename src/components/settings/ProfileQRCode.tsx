import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import QRCode from "react-qr-code";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function ProfileQRCode() {
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [qrSlug, setQrSlug] = useState<string>("");
  const [isRotating, setIsRotating] = useState(false);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("qr_slug")
      .eq("id", user.id)
      .single();

    if (error || !profile?.qr_slug) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load QR code");
      return;
    }

    // Use the current app URL, not the Supabase URL
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/join/${profile.qr_slug}`;
    setQrSlug(profile.qr_slug);
    setJoinUrl(url);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleRotate = async () => {
    setIsRotating(true);
    try {
      const { data, error } = await supabase.functions.invoke("rotate-qr-slug");

      if (error) throw error;

      if (data?.qrSlug) {
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/join/${data.qrSlug}`;
        setQrSlug(data.qrSlug);
        setJoinUrl(url);
        toast.success("QR code rotated successfully");
      }
    } catch (err) {
      console.error("Failed to rotate QR:", err);
      toast.error("Failed to rotate QR code");
    } finally {
      setIsRotating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    toast.success("Link copied to clipboard");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: "Chat with me", url: joinUrl });
    } else {
      toast.error("Sharing not supported on this device");
    }
  };

  if (!joinUrl) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <QRCode value={joinUrl} size={220} />
      <div className="text-xs break-all text-muted-foreground max-w-[220px]">
        {joinUrl}
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          Copy link
        </Button>
        <Button variant="outline" size="sm" onClick={handleShare}>
          Share
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRotate}
          disabled={isRotating}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRotating ? "animate-spin" : ""}`} />
          Rotate QR
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Scan to start a temporary chat. Rotate to generate a new link.
      </p>
    </div>
  );
}
