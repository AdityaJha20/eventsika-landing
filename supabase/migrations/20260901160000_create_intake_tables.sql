-- ==============================================================================
-- Eventsika Intake Tables Migration
-- Tables: leads, vendor_applications
-- Security: Row Level Security (RLS) enabled (Anon: DENIED, Backend Service: BYPASS)
-- ==============================================================================

-- 1. Celebration Leads Table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Customer & Celebration Details
    user_name VARCHAR(100) NOT NULL,
    user_phone VARCHAR(15) NOT NULL,
    city VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_date DATE NOT NULL,
    guest_count VARCHAR(50) NOT NULL,
    venue_type VARCHAR(20) NOT NULL,
    selected_services TEXT[] NOT NULL,
    budget_range VARCHAR(50) NOT NULL,
    whatsapp_consent BOOLEAN NOT NULL DEFAULT true,
    
    -- Correlation Tracking
    request_id VARCHAR(64) NULL,

    -- Data Integrity Constraints
    CONSTRAINT chk_leads_user_name_len CHECK (char_length(user_name) > 0 AND char_length(user_name) <= 100),
    CONSTRAINT chk_leads_user_phone_len CHECK (char_length(user_phone) >= 10 AND char_length(user_phone) <= 15),
    CONSTRAINT chk_leads_services_nonempty CHECK (array_length(selected_services, 1) > 0),
    CONSTRAINT chk_leads_whatsapp_consent CHECK (whatsapp_consent = true)
);

-- Leads Performance Indexes
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_user_phone ON public.leads (user_phone);
CREATE INDEX IF NOT EXISTS idx_leads_event_date ON public.leads (event_date);


-- 2. Vendor Partner Applications Table
CREATE TABLE IF NOT EXISTS public.vendor_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Partner & Business Details
    business_name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL,
    experience VARCHAR(50) NOT NULL DEFAULT '3–5 Years',
    portfolio_url VARCHAR(300) NOT NULL,
    categories TEXT[] NOT NULL,
    
    -- Correlation Tracking
    request_id VARCHAR(64) NULL,

    -- Data Integrity Constraints
    CONSTRAINT chk_vendor_business_name_len CHECK (char_length(business_name) > 0 AND char_length(business_name) <= 150),
    CONSTRAINT chk_vendor_contact_name_len CHECK (char_length(contact_name) > 0 AND char_length(contact_name) <= 100),
    CONSTRAINT chk_vendor_phone_len CHECK (char_length(phone) >= 10 AND char_length(phone) <= 15),
    CONSTRAINT chk_vendor_email_len CHECK (char_length(email) >= 5 AND char_length(email) <= 150),
    CONSTRAINT chk_vendor_portfolio_len CHECK (char_length(portfolio_url) >= 3 AND char_length(portfolio_url) <= 300),
    CONSTRAINT chk_vendor_categories_nonempty CHECK (array_length(categories, 1) > 0)
);

-- Vendor Applications Performance Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_apps_created_at ON public.vendor_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_apps_email ON public.vendor_applications (email);
CREATE INDEX IF NOT EXISTS idx_vendor_apps_phone ON public.vendor_applications (phone);


-- 3. Automatic Updated_At Timestamp Trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_leads_updated_at ON public.leads;
CREATE TRIGGER set_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_vendor_apps_updated_at ON public.vendor_applications;
CREATE TRIGGER set_vendor_apps_updated_at
    BEFORE UPDATE ON public.vendor_applications
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 4. Row Level Security (RLS) Configuration
-- Enabling RLS denies all anonymous and public access by default.
-- Trusted backend service accesses tables via SUPABASE_SERVICE_ROLE_KEY which automatically bypasses RLS.
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_applications ENABLE ROW LEVEL SECURITY;
