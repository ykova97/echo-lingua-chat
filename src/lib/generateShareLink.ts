import { supabase } from "@/integrations/supabase/client";

export interface ShareLinkResponse {
  share_url: string;
  token: string;
  expires_at: string;
  max_uses: number;
}

/**
 * Generates a secure share link for the authenticated user
 * @returns Promise with the share URL and token details
 * @throws Error if user is not authenticated or generation fails
 */
export async function generateShareLink(): Promise<ShareLinkResponse> {
  // Get the current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error("You must be logged in to generate a share link");
  }

  // Call the edge function
  const { data, error } = await supabase.functions.invoke("generate-share-link", {
    method: "POST",
  });

  if (error) {
    console.error("Error generating share link:", error);
    throw new Error(error.message || "Failed to generate share link");
  }

  return data as ShareLinkResponse;
}
