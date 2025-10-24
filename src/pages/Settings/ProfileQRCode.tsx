import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ProfileQRCode() {
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    generateQRCode();
  }, []);

  const generateQRCode = async () => {
    try {
      setLoading(true);
      setError("");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("User not authenticated");
        return;
      }

      console.log("Generating QR invite for user:", user.id);

      const { data, error: invokeError } = await supabase.functions.invoke("create-qr-invite", {
        body: { inviterId: user.id, ttlHours: 24, maxUses: 5 }
      });

      if (invokeError) {
        console.error("Error creating invite:", invokeError);
        setError("Failed to generate invite");
        toast.error("Failed to generate QR code");
        return;
      }

      if (data?.inviteUrl) {
        setInviteUrl(data.inviteUrl);
        console.log("Invite URL generated:", data.inviteUrl);
      } else {
        setError("No invite URL returned");
      }
    } catch (err) {
      console.error("Unexpected error generating QR code:", err);
      setError("Failed to generate invite");
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Link copied to clipboard");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Guest Invite QR Code</CardTitle>
          <CardDescription>Generate a QR code for guests to join</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !inviteUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Guest Invite QR Code</CardTitle>
          <CardDescription>Generate a QR code for guests to join</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-destructive">{error || "Failed to generate invite"}</p>
          <Button onClick={generateQRCode}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guest Invite QR Code</CardTitle>
        <CardDescription>
          Valid for 24 hours, up to 5 guests. Each guest gets their own temporary chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="bg-white p-4 rounded-lg">
          <QRCode value={inviteUrl} size={220} />
        </div>
        <div className="text-xs break-all text-muted-foreground max-w-full px-2 text-center">
          {inviteUrl}
        </div>
        <div className="flex gap-2">
          <Button onClick={copyToClipboard}>Copy Link</Button>
          <Button variant="outline" onClick={generateQRCode}>Generate New</Button>
        </div>
      </CardContent>
    </Card>
  );
}
