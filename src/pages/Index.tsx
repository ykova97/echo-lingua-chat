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
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Logo with glass effect */}
          <div className="flex justify-center mb-8 animate-fade-in">
            <div className="glass-card w-24 h-24 flex items-center justify-center shadow-glass">
              <MessageCircle className="w-12 h-12 text-primary" />
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-4 animate-fade-in">
            <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-primary via-primary to-purple-600 bg-clip-text text-transparent">
              Link
            </h1>
            <p className="text-2xl md:text-3xl text-foreground/70 font-light">
              Chat freely. Understand instantly.
            </p>
          </div>

          {/* Description */}
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Break language barriers with AI-powered translation. Message anyone in any language,
            and see conversations instantly translated to your preferred language.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 animate-fade-in">
            <Button 
              size="lg" 
              className="text-lg h-14 px-8 bg-gradient-to-r from-primary to-primary/80 hover:scale-105 transition-transform shadow-lg" 
              onClick={() => navigate("/auth")}
            >
              Get Started
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg h-14 px-8 glass border-white/30 hover:scale-105 transition-transform" 
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
          </div>
        </div>

        {/* Features with glass cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-24 max-w-5xl mx-auto">
          <div className="glass-card p-6 space-y-3 hover:scale-105 transition-transform duration-200">
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center">
              <Globe className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Real-Time Translation</h3>
            <p className="text-muted-foreground">
              Messages are instantly translated as you type. No delays, no waiting.
            </p>
          </div>

          <div className="glass-card p-6 space-y-3 hover:scale-105 transition-transform duration-200">
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Group Chats</h3>
            <p className="text-muted-foreground">
              Create multilingual group conversations where everyone sees messages in their language.
            </p>
          </div>

          <div className="glass-card p-6 space-y-3 hover:scale-105 transition-transform duration-200">
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center">
              <Zap className="w-7 h-7 text-primary" />
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
