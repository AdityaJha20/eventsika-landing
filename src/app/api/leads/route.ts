import { NextResponse } from "next/server";
import { sendNotificationEmail } from "@/lib/mailer";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface LeadRequestBody {
  userName?: string;
  userPhone?: string;
  city?: string;
  eventType?: string;
  eventDate?: string;
  guestCount?: string;
  venueType?: string;
  selectedServices?: string[];
  budgetRange?: string;
  whatsappConsent?: boolean;
  honeypot?: string;
}

export async function POST(request: Request) {
  // 1. IP-based rate limiting (Max 5 requests per 10 minutes)
  const rateLimit = checkRateLimit(request, "leads", {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.isAllowed) {
    return NextResponse.json(
      {
        success: false,
        message: "Too many submission attempts. Please wait a few minutes before trying again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimit.retryAfterSeconds.toString(),
          "X-RateLimit-Limit": "5",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // 2. Request payload size guard (Max 50 KB / 51,200 bytes)
  const MAX_PAYLOAD_SIZE = 51200; // 50 KB
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = parseInt(contentLength, 10);
    if (!isNaN(parsedLength) && parsedLength > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "Request payload too large. Maximum allowed size is 50 KB.",
        },
        { status: 413 }
      );
    }
  }

  try {
    const body: LeadRequestBody | null = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid request payload." },
        { status: 400 }
      );
    }

    // 1. Honeypot check for automated bots
    if (body.honeypot && body.honeypot.trim() !== "") {
      // Silent acknowledge to bot without processing
      return NextResponse.json({ success: true, message: "Lead processed." });
    }

    // 2. Server-side field sanitization and validation
    const userName = typeof body.userName === "string" ? body.userName.trim() : "";
    const userPhone = typeof body.userPhone === "string" ? body.userPhone.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const eventType = typeof body.eventType === "string" ? body.eventType.trim() : "";
    const eventDate = typeof body.eventDate === "string" ? body.eventDate.trim() : "";
    const guestCount = typeof body.guestCount === "string" ? body.guestCount.trim() : "";
    const venueType = typeof body.venueType === "string" ? body.venueType.trim() : "";
    const budgetRange = typeof body.budgetRange === "string" ? body.budgetRange.trim() : "";
    const selectedServices = Array.isArray(body.selectedServices)
      ? body.selectedServices.filter((s): s is string => typeof s === "string" && s.trim() !== "")
      : [];

    const cleanPhone = userPhone.replace(/\D/g, "");

    // Validation rules
    if (!userName || userName.length > 100) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid name (max 100 characters)." },
        { status: 400 }
      );
    }

    const hasValidChars = /^\+?[\d\s\-()]+$/.test(userPhone);
    const isValidPhone =
      hasValidChars &&
      (/^[6-9]\d{9}$/.test(cleanPhone) || /^(91|0)[6-9]\d{9}$/.test(cleanPhone));

    if (!cleanPhone || !isValidPhone) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid 10-digit phone number." },
        { status: 400 }
      );
    }

    if (!city || city.length > 100) {
      return NextResponse.json(
        { success: false, message: "Please select a valid city." },
        { status: 400 }
      );
    }

    if (!eventType || eventType.length > 100) {
      return NextResponse.json(
        { success: false, message: "Please select a valid event occasion." },
        { status: 400 }
      );
    }

    if (!eventDate) {
      return NextResponse.json(
        { success: false, message: "Please select your planned event date." },
        { status: 400 }
      );
    }

    if (!guestCount || guestCount.length > 100) {
      return NextResponse.json(
        { success: false, message: "Please specify your expected guest count." },
        { status: 400 }
      );
    }

    if (!venueType || venueType.length > 100) {
      return NextResponse.json(
        { success: false, message: "Please select your venue type." },
        { status: 400 }
      );
    }

    if (selectedServices.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please select at least one required service." },
        { status: 400 }
      );
    }

    const whatsappConsent = Boolean(body.whatsappConsent);

    if (!budgetRange || budgetRange.length > 100) {
      return NextResponse.json(
        { success: false, message: "Please select your planned budget range." },
        { status: 400 }
      );
    }

    if (!whatsappConsent) {
      return NextResponse.json(
        { success: false, message: "Please agree to be contacted on WhatsApp." },
        { status: 400 }
      );
    }

    // 3. Dispatch structured notification email to care@eventsika.in
    await sendNotificationEmail({
      type: "celebration_lead",
      title: `🎉 New Celebration Lead: ${userName} (${eventType} in ${city})`,
      data: {
        "Client Name": userName,
        "Phone Number": cleanPhone,
        City: city,
        "Occasion / Event": eventType,
        "Planned Date": eventDate,
        "Expected Guests": guestCount,
        "Venue Type": venueType,
        "Selected Services": selectedServices,
        "Budget Range": budgetRange,
        "WhatsApp Consent": "Yes",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Celebration details submitted successfully.",
    });
  } catch (error) {
    console.error("[Leads API Error]:", error);
    return NextResponse.json(
      {
        success: false,
        message: "We encountered an issue submitting your request. Please try again or reach out to care@eventsika.in.",
      },
      { status: 500 }
    );
  }
}
