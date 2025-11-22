import { supabase } from "@/integrations/supabase/client";

export interface CreateGuestSessionParams {
  token: string;
  display_name?: string;
}

export interface CreateGuestSessionResponse {
  conversation_id: string;
  guest_id: string;
  guest_jwt: string;
}

export interface GuestSessionError {
  error: "invalid_or_expired" | "invalid_input" | "rate_limit_exceeded" | "server_error";
  message: string;
}

/**
 * Creates a guest session from a share token (public endpoint, no auth required)
 * @param params - Token and optional display name
 * @returns Promise with conversation_id and guest_id
 * @throws Error with specific error codes for different failure scenarios
 */
export async function createGuestSession(
  params: CreateGuestSessionParams
): Promise<CreateGuestSessionResponse> {
  const { token, display_name } = params;

  // Client-side validation
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    throw new Error("Token is required");
  }

  if (display_name && display_name.length > 100) {
    throw new Error("Display name must be less than 100 characters");
  }

  try {
    // Call the edge function (no auth required)
    const { data, error } = await supabase.functions.invoke("create-guest-session-from-token", {
      body: {
        token: token.trim(),
        display_name: display_name?.trim() || null,
      },
    });

    if (error) {
      console.error("Error creating guest session:", error);
      
      // Parse error response for specific error codes
      if (error.message && typeof error.message === 'string') {
        try {
          const errorData = JSON.parse(error.message);
          throw new Error(errorData.message || errorData.error || error.message);
        } catch {
          throw new Error(error.message);
        }
      }
      
      throw new Error("Failed to create guest session");
    }

    // Check if the response contains an error field
    if (data && typeof data === 'object' && 'error' in data) {
      const errorData = data as GuestSessionError;
      throw new Error(errorData.message || errorData.error);
    }

    return data as CreateGuestSessionResponse;
  } catch (err) {
    console.error("createGuestSession error:", err);
    throw err;
  }
}
