// Types for the schema in supabase/migrations. Keep in sync when the migration changes.
// (Generated-style shape so it can be swapped for `supabase gen types typescript` output later.)

import type { Market } from "@/lib/markets";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "buyer" | "seller" | "vendor";
export type VendorCategoryValue =
  | "attorney"
  | "home_inspector"
  | "photographer"
  | "painter"
  | "stager"
  | "handyman"
  | "lender"
  | "home_insurance";
export type VendorStatus = "pending" | "approved" | "rejected";
export type ListingStatus = "pending" | "active" | "under_contract" | "sold" | "rejected";
/** "interest" is an expression of interest on a listing: a lead with structured details attached. */
export type LeadType = "listing" | "vendor" | "interest";

type ProfileRow = {
  id: string;
  email: string;
  phone: string | null;
  phone_verified: boolean;
  full_name: string | null;
  roles: UserRole[];
  is_admin: boolean;
  /** The market whose site this account signed up on; null for accounts created before markets existed. */
  market_id: string | null;
  created_at: string;
};

type VendorRow = {
  id: string;
  profile_id: string;
  category: VendorCategoryValue;
  business_name: string;
  headshot_url: string;
  bio: string;
  service_area: string;
  price_range: string;
  website: string | null;
  status: VendorStatus;
  founding_vendor: boolean;
  market_id: string;
  approved_at: string | null;
  lifecycle_unsubscribed_at: string | null;
  email_token: string;
  created_at: string;
};

type ListingRow = {
  id: string;
  seller_id: string;
  street: string;
  city: string;
  zip: string;
  hide_exact_address: boolean;
  price: number;
  beds: number;
  baths: number;
  sqft: number | null;
  description: string;
  status: ListingStatus;
  slug: string;
  market_id: string;
  created_at: string;
  updated_at: string;
};

type VendorPendingEditRow = {
  vendor_id: string;
  business_name: string;
  bio: string;
  headshot_url: string;
  category: VendorCategoryValue;
  submitted_at: string;
};

type VendorVerificationRow = {
  vendor_id: string;
  license_number: string | null;
  coi_path: string | null;
  coi_file_name: string | null;
  submitted_at: string | null;
  license_checked: boolean;
  coi_reviewed: boolean;
  phone_call_done: boolean;
  admin_notes: string | null;
  verified_at: string | null;
  updated_at: string;
};

type ListingPhotoRow = { id: string; listing_id: string; url: string; sort_order: number };

type LeadRow = {
  id: string;
  type: LeadType;
  target_id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  message: string;
  consent: boolean;
  source: string | null;
  /** Structured fields for an "interest" lead (see lib/interest.ts); null for other types. */
  details: Json | null;
  market_id: string;
  created_at: string;
};

type ListingAlertRow = {
  id: string;
  email: string;
  zip: string | null;
  unsubscribe_token: string;
  market_id: string;
  created_at: string;
  unsubscribed_at: string | null;
};

type MarketRow = Market & { created_at: string; updated_at: string };

export type AlertSendStatus = "sending" | "sent" | "queued" | "skipped" | "failed";

type ListingAlertSendRow = {
  id: string;
  alert_id: string;
  listing_id: string;
  market_id: string;
  status: AlertSendStatus;
  via: "instant" | "digest" | null;
  send_date: string | null;
  resend_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

export type VendorEmailKind = "day2" | "day14" | "monthly";

type VendorEmailRow = {
  id: string;
  vendor_id: string;
  kind: VendorEmailKind;
  period: string;
  status: "sending" | "sent" | "failed";
  resend_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

type ListingSyndicationRow = {
  id: string;
  listing_id: string;
  market_id: string;
  channel: "facebook";
  status: "posting" | "posted" | "skipped" | "failed";
  external_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type CourseSignupRow = {
  id: string;
  email: string;
  market_id: string;
  /** The next lesson to send, 1 through 7; 8 once the course is finished. */
  next_day: number;
  unsubscribe_token: string;
  source: string | null;
  created_at: string;
  last_sent_at: string | null;
  completed_at: string | null;
  unsubscribed_at: string | null;
};

export type ListingDraftStatus = "draft" | "pending_verification" | "verified";
export type ListingDraftStep = "contact" | "address" | "details" | "photos" | "submitted";

type ListingDraftRow = {
  id: string;
  market_id: string;
  token_hash: string;
  resume_token_hash: string | null;
  status: ListingDraftStatus;
  step: ListingDraftStep;
  full_name: string;
  email: string;
  phone: string | null;
  street: string | null;
  zip: string | null;
  hide_exact_address: boolean;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  description: string | null;
  photo_urls: string[];
  photo_uploads: number;
  source: string | null;
  ip_hash: string | null;
  unsubscribe_token: string;
  reminder_sent_at: string | null;
  reminders_unsubscribed_at: string | null;
  submitted_at: string | null;
  verification_sent_at: string | null;
  verified_at: string | null;
  profile_id: string | null;
  listing_id: string | null;
  created_at: string;
  updated_at: string;
};

type AreaWaitlistRow = {
  id: string;
  email: string;
  market_id: string;
  zip: string;
  source: string | null;
  created_at: string;
};

type CourseEmailRow = {
  id: string;
  signup_id: string;
  day: number;
  status: "sending" | "sent" | "skipped" | "failed";
  resend_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

type ListingAiUsageRow = {
  id: string;
  draft_id: string;
  profile_id: string | null;
  market_id: string;
  listing_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  variants: number;
  created_at: string;
};

type SignInLinkRequestRow = { id: number; email: string; created_at: string };

type VendorCertificationRow = {
  vendor_id: string;
  licensed: boolean;
  insured: boolean;
  understands_connector: boolean;
  handles_own_agreements: boolean;
  read_terms: boolean;
  certified_at: string;
};

export type Database = {
  public: {
    Tables: {
      markets: {
        Row: MarketRow;
        Insert: Omit<MarketRow, "id" | "created_at" | "updated_at" | "launched_at"> & Partial<Pick<MarketRow, "id" | "launched_at">>;
        Update: Partial<MarketRow>;
        Relationships: [];
      };
      listing_alert_sends: {
        Row: ListingAlertSendRow;
        Insert: Pick<ListingAlertSendRow, "alert_id" | "listing_id" | "market_id" | "status"> & Partial<ListingAlertSendRow>;
        Update: Partial<ListingAlertSendRow>;
        Relationships: [
          { foreignKeyName: "listing_alert_sends_alert_id_fkey"; columns: ["alert_id"]; isOneToOne: false; referencedRelation: "listing_alerts"; referencedColumns: ["id"] },
          { foreignKeyName: "listing_alert_sends_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "listings"; referencedColumns: ["id"] },
        ];
      };
      vendor_emails: {
        Row: VendorEmailRow;
        Insert: Pick<VendorEmailRow, "vendor_id" | "kind" | "status"> & Partial<VendorEmailRow>;
        Update: Partial<VendorEmailRow>;
        Relationships: [
          { foreignKeyName: "vendor_emails_vendor_id_fkey"; columns: ["vendor_id"]; isOneToOne: false; referencedRelation: "vendors"; referencedColumns: ["id"] },
        ];
      };
      listing_syndication: {
        Row: ListingSyndicationRow;
        Insert: Pick<ListingSyndicationRow, "listing_id" | "market_id" | "channel" | "status"> & Partial<ListingSyndicationRow>;
        Update: Partial<ListingSyndicationRow>;
        Relationships: [
          { foreignKeyName: "listing_syndication_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "listings"; referencedColumns: ["id"] },
        ];
      };
      course_signups: {
        Row: CourseSignupRow;
        Insert: Pick<CourseSignupRow, "email" | "market_id"> & Partial<CourseSignupRow>;
        Update: Partial<CourseSignupRow>;
        Relationships: [];
      };
      course_emails: {
        Row: CourseEmailRow;
        Insert: Pick<CourseEmailRow, "signup_id" | "day" | "status"> & Partial<CourseEmailRow>;
        Update: Partial<CourseEmailRow>;
        Relationships: [
          { foreignKeyName: "course_emails_signup_id_fkey"; columns: ["signup_id"]; isOneToOne: false; referencedRelation: "course_signups"; referencedColumns: ["id"] },
        ];
      };
      listing_drafts: {
        Row: ListingDraftRow;
        Insert: Pick<ListingDraftRow, "market_id" | "token_hash" | "full_name" | "email"> & Partial<ListingDraftRow>;
        Update: Partial<ListingDraftRow>;
        Relationships: [];
      };
      area_waitlist: {
        Row: AreaWaitlistRow;
        Insert: Pick<AreaWaitlistRow, "email" | "market_id" | "zip"> & Partial<AreaWaitlistRow>;
        Update: Partial<AreaWaitlistRow>;
        Relationships: [];
      };
      listing_ai_usage: {
        Row: ListingAiUsageRow;
        Insert: Pick<ListingAiUsageRow, "draft_id" | "market_id" | "model"> & Partial<ListingAiUsageRow>;
        Update: Partial<ListingAiUsageRow>;
        Relationships: [
          { foreignKeyName: "listing_ai_usage_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "listings"; referencedColumns: ["id"] },
        ];
      };
      sign_in_link_requests: {
        Row: SignInLinkRequestRow;
        Insert: Pick<SignInLinkRequestRow, "email">;
        Update: Partial<SignInLinkRequestRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & Pick<ProfileRow, "id" | "email">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      vendors: {
        Row: VendorRow;
        Insert: Omit<VendorRow, "id" | "status" | "founding_vendor" | "created_at" | "website" | "market_id" | "approved_at" | "lifecycle_unsubscribed_at" | "email_token"> &
          Partial<Pick<VendorRow, "id" | "status" | "founding_vendor" | "created_at" | "website" | "market_id" | "approved_at" | "lifecycle_unsubscribed_at" | "email_token">>;
        Update: Partial<VendorRow>;
        Relationships: [
          { foreignKeyName: "vendors_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "vendors_market_id_fkey"; columns: ["market_id"]; isOneToOne: false; referencedRelation: "markets"; referencedColumns: ["id"] },
        ];
      };
      listings: {
        Row: ListingRow;
        Insert: Omit<ListingRow, "id" | "city" | "hide_exact_address" | "sqft" | "status" | "slug" | "created_at" | "updated_at" | "market_id"> &
          Partial<Pick<ListingRow, "id" | "city" | "hide_exact_address" | "sqft" | "status" | "slug" | "created_at" | "updated_at" | "market_id">>;
        Update: Partial<ListingRow>;
        Relationships: [
          { foreignKeyName: "listings_seller_id_fkey"; columns: ["seller_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "listings_market_id_fkey"; columns: ["market_id"]; isOneToOne: false; referencedRelation: "markets"; referencedColumns: ["id"] },
        ];
      };
      listing_photos: {
        Row: ListingPhotoRow;
        Insert: Omit<ListingPhotoRow, "id" | "sort_order"> & Partial<Pick<ListingPhotoRow, "id" | "sort_order">>;
        Update: Partial<ListingPhotoRow>;
        Relationships: [
          { foreignKeyName: "listing_photos_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "listings"; referencedColumns: ["id"] },
        ];
      };
      leads: {
        Row: LeadRow;
        Insert: Omit<LeadRow, "id" | "created_at" | "sender_phone" | "source" | "details"> &
          Partial<Pick<LeadRow, "id" | "created_at" | "sender_phone" | "source" | "details">>;
        Update: Partial<LeadRow>;
        Relationships: [];
      };
      listing_alerts: {
        Row: ListingAlertRow;
        Insert: Pick<ListingAlertRow, "email" | "market_id"> & Partial<ListingAlertRow>;
        Update: Partial<ListingAlertRow>;
        Relationships: [];
      };
      vendor_certifications: {
        Row: VendorCertificationRow;
        Insert: Omit<VendorCertificationRow, "certified_at"> & Partial<Pick<VendorCertificationRow, "certified_at">>;
        Update: Partial<VendorCertificationRow>;
        Relationships: [
          { foreignKeyName: "vendor_certifications_vendor_id_fkey"; columns: ["vendor_id"]; isOneToOne: true; referencedRelation: "vendors"; referencedColumns: ["id"] },
        ];
      };
      vendor_pending_edits: {
        Row: VendorPendingEditRow;
        Insert: Omit<VendorPendingEditRow, "submitted_at"> & Partial<Pick<VendorPendingEditRow, "submitted_at">>;
        Update: Partial<VendorPendingEditRow>;
        Relationships: [
          { foreignKeyName: "vendor_pending_edits_vendor_id_fkey"; columns: ["vendor_id"]; isOneToOne: true; referencedRelation: "vendors"; referencedColumns: ["id"] },
        ];
      };
      vendor_verifications: {
        Row: VendorVerificationRow;
        Insert: Pick<VendorVerificationRow, "vendor_id"> & Partial<VendorVerificationRow>;
        Update: Partial<VendorVerificationRow>;
        Relationships: [
          { foreignKeyName: "vendor_verifications_vendor_id_fkey"; columns: ["vendor_id"]; isOneToOne: true; referencedRelation: "vendors"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: {
      public_vendors: {
        Row: Omit<VendorRow, "profile_id" | "status" | "approved_at" | "lifecycle_unsubscribed_at" | "email_token"> & { verified_at: string | null };
        Relationships: [];
      };
      public_listings: {
        Row: Omit<ListingRow, "seller_id" | "street"> & { street: string | null };
        Relationships: [];
      };
      public_listing_photos: {
        Row: ListingPhotoRow;
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      submit_vendor_application: {
        Args: {
          p_market: string;
          p_category: VendorCategoryValue;
          p_business_name: string;
          p_headshot_url: string;
          p_bio: string;
          p_service_area: string;
          p_price_range: string;
          p_website: string;
          p_licensed: boolean;
          p_insured: boolean;
          p_understands_connector: boolean;
          p_handles_own_agreements: boolean;
          p_read_terms: boolean;
        };
        Returns: string;
      };
      queue_vendor_edit: {
        Args: { p_vendor_id: string; p_business_name: string; p_bio: string; p_headshot_url: string; p_category: VendorCategoryValue };
        Returns: undefined;
      };
      apply_vendor_edit: { Args: { p_vendor_id: string }; Returns: boolean };
      finalize_listing_draft: {
        Args: { p_draft: string; p_profile: string; p_city: string; p_photo_urls: string[] };
        Returns: { id: string; slug: string }[];
      };
      submit_listing: {
        Args: {
          p_market: string;
          p_street: string;
          p_city: string;
          p_zip: string;
          p_hide_exact_address: boolean;
          p_price: number;
          p_beds: number;
          p_baths: number;
          p_sqft: number | null;
          p_description: string;
          p_photo_urls: string[];
        };
        Returns: { id: string; slug: string }[];
      };
      submit_vendor_verification: { Args: { p_license_number: string; p_coi_path: string; p_coi_file_name: string }; Returns: string };
      replace_listing_photos: { Args: { p_listing_id: string; p_photo_urls: string[] }; Returns: undefined };
    };
    Enums: {
      user_role: UserRole;
      vendor_category: VendorCategoryValue;
      vendor_status: VendorStatus;
      listing_status: ListingStatus;
      lead_type: LeadType;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = ProfileRow;
export type Vendor = VendorRow;
export type VendorPendingEdit = VendorPendingEditRow;
export type VendorVerification = VendorVerificationRow;
export type PublicVendor = Database["public"]["Views"]["public_vendors"]["Row"];
export type Listing = ListingRow;
export type ListingPhoto = ListingPhotoRow;
export type PublicListing = Database["public"]["Views"]["public_listings"]["Row"];
export type ListingAlert = ListingAlertRow;
export type Lead = LeadRow;
export type CourseSignup = CourseSignupRow;
export type ListingDraft = ListingDraftRow;
