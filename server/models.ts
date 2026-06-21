
export interface AnonymousTrialTracker {
    device_fingerprint_hash: string;
    ip_address: string;
    invoice_count: number;
    last_request_timestamp: number;
}

export interface User {
    id: string;
    phone_or_email: string;
    otp_secret: string;
    full_name?: string;
    business_name?: string;
    shop_slug?: string;
    owner_pin?: string;
}

export interface Staff {
    id: string;
    shop_id: string;
    name_slug: string;
    owner_generated_pin: string;
    is_active: boolean;
}

export interface MerchantSession {
    session_id: string;
    user_id: string;
    device_fingerprint: string;
    last_active_ip: string;
    last_active_region: string;
    is_suspicious_locked: boolean;
}

export interface StaffActivityLog {
    id: string;
    terminal_id: string;
    staff_id: string;
    action_taken: string;
    timestamp: number;
    ip_address: string;
    device_hardware_profile: string;
    location: string;
    is_flagged: boolean;
}
