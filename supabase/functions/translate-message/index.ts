import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { chatId, message, sourceLanguage, replyToId } = await req.json();
    
    // Get auth user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Sending message from user:', user.id);

    // Insert the message
    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        original_text: message,
        source_language: sourceLanguage,
        reply_to_id: replyToId || null,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error inserting message:', messageError);
      throw messageError;
    }

    console.log('Message inserted:', newMessage.id);

    // Get all participants in the chat
    const { data: participants, error: participantsError } = await supabase
      .from('chat_participants')
      .select(`
        user_id,
        profiles (
          preferred_language
        )
      `)
      .eq('chat_id', chatId);

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      throw participantsError;
    }

    console.log('Found participants:', participants.length);

    // Translate for each participant
    const translations = await Promise.all(
      participants.map(async (participant: any) => {
        const targetLanguage = participant.profiles.preferred_language;
        
        // Skip translation if same language as source
        if (targetLanguage === sourceLanguage) {
          return {
            message_id: newMessage.id,
            user_id: participant.user_id,
            translated_text: message,
            target_language: targetLanguage,
          };
        }

        console.log(`Translating to ${targetLanguage} for user ${participant.user_id}`);

        // Call Lovable AI for translation
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Preserve tone, emotion, and context. Only return the translated text, nothing else.`,
              },
              {
                role: 'user',
                content: message,
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Translation API error:', response.status, errorText);
          throw new Error(`Translation failed: ${errorText}`);
        }

        const data = await response.json();
        const translatedText = data.choices[0].message.content;

        console.log('Translation successful:', translatedText.substring(0, 50));

        return {
          message_id: newMessage.id,
          user_id: participant.user_id,
          translated_text: translatedText,
          target_language: targetLanguage,
        };
      })
    );

    // Insert all translations
    const { error: translationsError } = await supabase
      .from('message_translations')
      .insert(translations);

    if (translationsError) {
      console.error('Error inserting translations:', translationsError);
      throw translationsError;
    }

    console.log('All translations inserted successfully');

    return new Response(
      JSON.stringify({ success: true, messageId: newMessage.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in translate-message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});