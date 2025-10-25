import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Globe, Camera, Mail, Phone, User } from "lucide-react";
import { BlockedUsers } from "@/components/settings/BlockedUsers";
import { Separator } from "@/components/ui/separator";
import ProfileQRCode from "@/pages/Settings/ProfileQRCode";
import ProfileQRCode from "@/components/settings/ProfileQRCode";


const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "pt", name: "Portuguese", flag: "🇧🇷" },
];

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("en");
  const [handle, setHandle] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    const loadUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);
      setEmail(user.email || "");
      setPhone(user.phone || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, preferred_language, profile_image, handle")
        .eq("id", user.id)
        .single();

      if (profile) {
        setName(profile.name);
        setLanguage(profile.preferred_language);
        setProfileImage(profile.profile_image);
        setHandle(profile.handle || "");
      }
    };

    loadUserProfile();
  }, [navigate]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Delete old profile image if exists
      if (profileImage) {
        const oldPath = profileImage.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('profile-images')
            .remove([`${userId}/${oldPath}`]);
        }
      }

      // Upload new image
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      // Update profile with new image URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_image: data.publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setProfileImage(data.publicUrl);
      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          name,
          preferred_language: language,
          handle: handle.trim() || null
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      // Update email if changed
      if (email && email !== (await supabase.auth.getUser()).data.user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email,
        });
        if (emailError) throw emailError;
      }

      // Update phone if changed
      if (phone && phone !== (await supabase.auth.getUser()).data.user?.phone) {
        const { error: phoneError } = await supabase.auth.updateUser({
          phone,
        });
        if (phoneError) throw phoneError;
      }

      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">
  <h2 className="text-lg font-semibold mb-2">Invite with QR</h2>
  <ProfileQRCode />
</div>

    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/chats")}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {/* Settings Form */}
        <div className="bg-card rounded-2xl shadow-sm p-6 border border-border space-y-6">
          {/* Profile Picture */}
          <div className="space-y-4">
            <Label className="text-base">Profile Picture</Label>
            <div className="flex items-center gap-4">
              <Avatar className="w-24 h-24">
                <AvatarImage src={profileImage || undefined} />
                <AvatarFallback className="text-2xl">
                  {name.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  <Camera className="w-4 h-4" />
                  {uploading ? "Uploading..." : "Change Photo"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">
                  Max size: 5MB. JPG, PNG, or GIF
                </p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2 text-base">
              <User className="w-4 h-4" />
              Name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12"
            />
            <p className="text-xs text-muted-foreground">
              Changing your email will require verification
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2 text-base">
              <Phone className="w-4 h-4" />
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12"
            />
            <p className="text-xs text-muted-foreground">
              Include country code. Changing will require verification
            </p>
          </div>

          {/* Handle */}
          <div className="space-y-2">
            <Label htmlFor="handle" className="text-base">
              Handle (@username)
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">@</span>
              <Input
                id="handle"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                className="pl-9 h-12"
                maxLength={20}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Your unique handle. Letters, numbers, and underscores only.
            </p>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label htmlFor="language" className="flex items-center gap-2 text-base">
              <Globe className="w-4 h-4" />
              Preferred Language
            </Label>
            <p className="text-sm text-muted-foreground">
              Messages will be automatically translated into this language
            </p>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full h-12"
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Guest Invite QR Code Section */}
        <div className="bg-card rounded-2xl shadow-sm p-6 border border-border space-y-4 mt-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Guest Invite</h2>
            <p className="text-sm text-muted-foreground">
              Generate a QR code to invite guests for temporary chats
            </p>
          </div>
          <Separator />
          <ProfileQRCode />
        </div>

        {/* Blocked Users Section */}
        <div className="bg-card rounded-2xl shadow-sm p-6 border border-border space-y-4 mt-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Blocked Users</h2>
            <p className="text-sm text-muted-foreground">
              Manage users you've blocked
            </p>
          </div>
          <Separator />
          <BlockedUsers />
        </div>
      </div>
    </div>
  );
};

export default Settings;