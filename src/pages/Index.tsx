import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageCircle, Globe, Users, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      navigate("/chats");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center shadow-2xl">
              <MessageCircle className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground">
              Link
            </h1>
            <p className="text-2xl md:text-3xl text-muted-foreground font-light">
              Chat freely. Understand instantly.
            </p>
          </div>

          {/* Description */}
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Break language barriers with AI-powered translation. Message anyone in any language,
            and see conversations instantly translated to your preferred language.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button size="lg" className="text-lg h-14 px-8" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" className="text-lg h-14 px-8" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto">
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Real-Time Translation</h3>
            <p className="text-muted-foreground">
              Messages are instantly translated as you type. No delays, no waiting.
            </p>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Group Chats</h3>
            <p className="text-muted-foreground">
              Create multilingual group conversations where everyone sees messages in their language.
            </p>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">AI-Powered</h3>
            <p className="text-muted-foreground">
              Advanced AI ensures accurate translations that preserve tone and context.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-24 text-muted-foreground">
          <p>Connect with anyone, anywhere, in any language.</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
