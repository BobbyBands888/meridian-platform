// Types for the schema in supabase/migrations. Keep in sync when the migration changes.
// (Generated-style shape so it can be swapped for `supabase gen types typescript` output later.)

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
export type LeadType = "listing" | "vendor";

type ProfileRow = {
  id: string;
  email: string;
  phone: string | null;
  phone_verified: boolean;
  full_name: string | null;
  roles: UserRole[];
  is_admin: boolean;
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
  created_at: string;
};

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
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & Pick<ProfileRow, "id" | "email">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      vendors: {
        Row: VendorRow;
        Insert: Omit<VendorRow, "id" | "status" | "founding_vendor" | "created_at" | "website"> &
          Partial<Pick<VendorRow, "id" | "status" | "founding_vendor" | "created_at" | "website">>;
        Update: Partial<VendorRow>;
        Relationships: [
          { foreignKeyName: "vendors_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      listings: {
        Row: ListingRow;
        Insert: Omit<ListingRow, "id" | "city" | "hide_exact_address" | "sqft" | "status" | "slug" | "created_at" | "updated_at"> &
          Partial<Pick<ListingRow, "id" | "city" | "hide_exact_address" | "sqft" | "status" | "slug" | "created_at" | "updated_at">>;
        Update: Partial<ListingRow>;
        Relationships: [
          { foreignKeyName: "listings_seller_id_fkey"; columns: ["seller_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
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
        Insert: Omit<LeadRow, "id" | "created_at" | "sender_phone" | "source"> &
          Partial<Pick<LeadRow, "id" | "created_at" | "sender_phone" | "source">>;
        Update: Partial<LeadRow>;
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
        Row: Omit<VendorRow, "profile_id" | "status"> & { verified_at: string | null };
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
      submit_listing: {
        Args: {
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
export type Lead = LeadRow;
