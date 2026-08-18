import { NextResponse } from "next/server";
import { sendNotificationEmail } from "@/lib/mailer";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface VendorRequestBody {
  businessName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  city?: string;
  experience?: string;
  portfolioUrl?: string;
  categories?: string[];
  honeypot?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  // 1. IP-based rate limiting (Max 5 requests per 10 minutes)
  const rateLimit = checkRateLimit(request, "vendor_applications", {
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
    const body: VendorRequestBody | null = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid request payload." },
        { status: 400 }
      );
    }

    // 1. Honeypot check for automated bots
    if (body.honeypot && body.honeypot.trim() !== "") {
      // Silent acknowledge to bot without processing
      return NextResponse.json({ success: true, message: "Application received." });
    }

    // 2. Server-side field sanitization and validation
    const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
    const contactName = typeof body.contactName === "string" ? body.contactName.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const experience = typeof body.experience === "string" ? body.experience.trim() : "";
    const portfolioUrl = typeof body.portfolioUrl === "string" ? body.portfolioUrl.trim() : "";
    const categories = Array.isArray(body.categories)
      ? body.categories.filter((c): c is string => typeof c === "string" && c.trim() !== "")
      : [];

    const cleanPhone = phone.replace(/\D/g, "");

    // Validation rules
    if (!businessName || businessName.length > 150) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid business/brand name (max 150 characters)." },
        { status: 400 }
      );
    }

    if (!contactName || contactName.length > 100) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid contact person name." },
        { status: 400 }
      );
    }

    if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 15) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid 10-digit WhatsApp phone number." },
        { status: 400 }
      );
    }

    if (!email || !EMAIL_REGEX.test(email) || email.length > 150) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (!city || city.length > 100) {
      return NextResponse.json(
        { success: false, message: "Please specify your primary operating city." },
        { status: 400 }
      );
    }

    if (!portfolioUrl || portfolioUrl.length > 300) {
      return NextResponse.json(
        { success: false, message: "Please provide your portfolio or Instagram link." },
        { status: 400 }
      );
    }

    if (categories.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please select at least one service category." },
        { status: 400 }
      );
    }

    // 3. Dispatch structured notification email to care@eventsika.in
    await sendNotificationEmail({
      type: "vendor_application",
      title: `🤝 New Vendor Partner Application: ${businessName} (${city})`,
      replyTo: email,
      data: {
        "Brand / Business": businessName,
        "Contact Person": contactName,
        "WhatsApp Phone": cleanPhone,
        "Email Address": email,
        "Operating City": city,
        "Industry Experience": experience || "Not specified",
        "Portfolio / Link": portfolioUrl,
        "Service Categories": categories,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Vendor application submitted successfully.",
    });
  } catch (error) {
    console.error("[Vendor Application API Error]:", error);
    return NextResponse.json(
      {
        success: false,
        message: "We encountered an issue submitting your application. Please try again or reach out to care@eventsika.in.",
      },
      { status: 500 }
    );
  }
}
