export interface Recipient {
  id: string;
  contact_id?: string;
  display_name: string;
  address_type: "phone" | "email";
  address_value: string;
  is_valid: boolean;
  is_link_user: boolean;
  avatar_url?: string;
}
