import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  BookingModalProvider,
  BookingTriggerButton,
} from "@/components/consultation/BookingExperience";
import {
  ORGANIZATION_ID,
  SITE_URL,
  breadcrumbJsonLd,
  pageMetadata,
  serializeJsonLd,
} from "@/lib/seo";
import { DEFAULT_CONSULTATION_PRICE_PAISE } from "@/lib/backend/types/payment-and-consultation";
import styles from "./diwali-consultation.module.css";

const SEO_TITLE = "Personalized Celebration Planning Consultation";
const SEO_DESCRIPTION =
  "Book a 1-on-1 celebration planning consultation with Eventsika's planners. Get expert guidance on design, budgets, vendors and execution. Consultation fee ₹2,999.";

export const metadata: Metadata = pageMetadata({
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  path: "/diwali-consultation",
});

// Price comes from the same constant the checkout charges, so the schema cannot drift from it.
const consultationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${SITE_URL}/diwali-consultation#service`,
  name: "1-on-1 Celebration Planning Consultation",
  serviceType: "Celebration planning consultation",
  description:
    "A dedicated 60-minute, 1-on-1 celebration planning session covering design, budget, vendors and execution, followed by a written summary and milestone checklist.",
  url: `${SITE_URL}/diwali-consultation`,
  provider: { "@id": ORGANIZATION_ID },
  offers: {
    "@type": "Offer",
    price: DEFAULT_CONSULTATION_PRICE_PAISE / 100,
    priceCurrency: "INR",
    url: `${SITE_URL}/diwali-consultation`,
  },
};

const BENEFITS_DATA = [
  {
    title: "Personalised Planning",
    description: "Tailored directly to your home layout, family traditions, and unique guest scale.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    title: "Eventsika Lead Expert",
    description: "Direct guidance from seasoned planners who orchestrate luxury celebrations.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
  },
  {
    title: "Venue & Vendor Guidance",
    description: "Thoughtful recommendations from vetted decorators, caterers, and artists.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
  },
  {
    title: "1-on-1 Consultation",
    description: "Direct, uninterrupted strategy session dedicated entirely to your vision.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

const CHECKLIST_ITEMS = [
  "Clear Planning Roadmap & Milestone Timeline",
  "Budget Allocation & Cost Optimization Guidance",
  "Thematic Decor, Floral & Lighting Ideas",
  "Trusted Vendor & Gourmet Catering Shortlists",
  "Venue Flow & Layout Utilization Suggestions",
  "Custom Action Plan Delivered Post-Session",
];

const STEPS_DATA = [
  {
    step: "01",
    title: "Book Your Slot",
    description:
      "Select a convenient date and time for your personalized 60-minute celebration strategy session.",
  },
  {
    step: "02",
    title: "Consult With Our Expert",
    description:
      "Meet 1-on-1 with our lead planner to explore your theme, guest count, venue setup, and budget vision.",
  },
  {
    step: "03",
    title: "Get a Tailored Plan",
    description:
      "Receive a structured celebration blueprint, vetted vendor options, and actionable execution steps.",
  },
];

const TESTIMONIALS_DATA = [
  {
    quote:
      "Booking the consultation was the best decision for our festive anniversary celebration. We avoided two costly venue mistakes and walked away with a crystal-clear checklist.",
    name: "Ritu Malhotra",
    city: "Gurgaon",
  },
  {
    quote:
      "Extremely professional, patient, and knowledgeable. Within an hour, they organized our multi-day festive events into a seamless, stress-free timeline.",
    name: "Vikram Kapur",
    city: "Mumbai",
  },
];

const INCLUSIONS_DATA = [
  "Dedicated 60-minute 1-on-1 strategy session",
  "Custom theme, decor & lighting moodboard suggestions",
  "Realistic line-item budget allocation template",
  "Handpicked vendor recommendations tailored to your style",
  "Post-session written summary & milestone checklist",
  "Priority booking status for full execution coordination",
];

export default function ConsultationPage() {
  return (
    <BookingModalProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            consultationJsonLd,
            breadcrumbJsonLd("Consultation", "/diwali-consultation"),
          ]),
        }}
      />
      <div className={styles.pageWrapper}>
      {/* 1. Global Navigation */}
      <Navbar />

      <main id="main-content">
        {/* 2. Consultation Hero Section */}
        <section className={styles.heroSection} aria-labelledby="consultation-hero-heading">
          <div className={styles.container}>
            <div className={styles.heroGrid}>
              {/* Left Column: Consultation Details & Typography */}
              <div className={styles.heroContent}>
                {/* Eyebrow framed by champagne-gold lines, a pine sprig and a cranberry bauble */}
                <div className={styles.heroBadgeWrapper}>
                  <span className={styles.badgeLine} aria-hidden="true" />
                  <PineSprig className={styles.badgeSprig} />
                  <span className={styles.heroEyebrow}>Personalized Celebration Consultation</span>
                  <span className={styles.badgeBauble} aria-hidden="true" />
                  <span className={styles.badgeLine} aria-hidden="true" />
                </div>

                <h1 id="consultation-hero-heading" className={styles.heroTitle}>
                  Your Celebration,<br />
                  <span className={styles.heroTitleHighlight}>Thoughtfully Planned.</span>
                </h1>

                <p className={styles.heroDescription}>
                  From intimate family gatherings to unforgettable celebrations, get expert guidance on design,
                  budgets, vendors and execution. Bring your vision to life with a thoughtfully planned experience.
                </p>

                {/* Hero Consultation Fee */}
                <div className={styles.heroPricingBox}>
                  <div className={styles.pricingHeaderRow}>
                    <span className={styles.pricingBadge}>Consultation Fee</span>
                  </div>

                  <div className={styles.feeAmount}>₹2,999</div>

                  <p className={styles.pricingTerms}>
                    One-time fee for a dedicated 60-minute, 1-on-1 consultation with our planners.
                  </p>
                </div>

                {/* Primary CTA (Inert / Visual) */}
                <div className={styles.heroCtaWrapper}>
                  {/* Payment Trust Indicator */}
                  <div
                    className={styles.paymentTrustIndicator}
                    aria-label="Supported payment methods: UPI, Google Pay, PhonePe, Paytm, Amazon Pay, CRED"
                  >
                    <span className={styles.paymentTrustLabel}>WE SUPPORT</span>
                    <div className={styles.paymentLogosRow}>
                      <Image
                        src="/payment-logos/upi-icon.svg"
                        alt="UPI"
                        width={37}
                        height={22}
                        className={styles.paymentLogoUpi}
                      />
                      <Image
                        src="/payment-logos/google-pay-primary-logo-logo-svgrepo-com.svg"
                        alt="Google Pay"
                        width={80}
                        height={32}
                        className={styles.paymentLogoGpay}
                      />
                      <Image
                        src="/payment-logos/phonepe-icon.svg"
                        alt="PhonePe"
                        width={28}
                        height={28}
                        className={styles.paymentLogoPhonepe}
                      />
                      <Image
                        src="/payment-logos/paytm-icon.svg"
                        alt="Paytm"
                        width={64}
                        height={20}
                        className={styles.paymentLogoPaytm}
                      />
                      <Image
                        src="/payment-logos/amazon-pay-icon.svg"
                        alt="Amazon Pay"
                        width={64}
                        height={22}
                        className={styles.paymentLogoAmazon}
                      />
                      <Image
                        src="/payment-logos/cred-svgrepo-com.svg"
                        alt="CRED"
                        width={28}
                        height={28}
                        className={styles.paymentLogoCred}
                      />
                    </div>
                  </div>

                  <BookingTriggerButton
                    variant="hero"
                    className={styles.primaryCtaBtn}
                    ariaLabel="Book My Consultation for ₹2,999"
                  />
                  <span className={styles.ctaTrustNote}>
                    ✓ 100% Dedicated Session • No Hidden Fees • Tailored Celebration Blueprint
                  </span>
                </div>
              </div>

              {/* Right Column: Consultation Image */}
              <div className={styles.heroImageColumn}>
                <PineSprig className={styles.imageSprig} withBauble />
                <div className={styles.heroImageFrame}>
                  <Image
                    src="/images/diwali-consultation-hero.webp"
                    alt="Professional Eventsika event planning consultant guiding a couple in an upscale home living room"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 600px"
                    className={styles.heroImage}
                  />
                  <div className={styles.heroImageOverlay} />
                  <div className={styles.heroImageBadge}>
                    <div className={styles.badgeIconWrapper}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </div>
                    <div className={styles.badgeTextGroup}>
                      <span className={styles.badgeTextMain}>Signature Consultation</span>
                      <span className={styles.badgeTextSub}>Direct 1-on-1 strategy with senior planners</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Benefits Strip */}
        <section className={styles.benefitsSection} aria-label="Consultation Key Benefits">
          <div className={styles.container}>
            <ul className={styles.benefitsGrid}>
              {BENEFITS_DATA.map((benefit) => (
                <li key={benefit.title} className={styles.benefitCard}>
                  <div className={styles.benefitIconContainer}>{benefit.icon}</div>
                  <h2 className={styles.benefitTitle}>{benefit.title}</h2>
                  <p className={styles.benefitText}>{benefit.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 4. Why Book a Consultation (Editorial Section) */}
        <section className={styles.whySection} aria-labelledby="why-heading">
          <div className={styles.container}>
            <div className={styles.whyGrid}>
              {/* Left: Editorial Narrative & Checklist */}
              <div className={styles.whyContent}>
                <div className={styles.eyebrow}>CLARITY &amp; CONFIDENCE</div>
                <h2 id="why-heading" className={styles.sectionTitle}>
                  Plan with Clarity. Celebrate with Confidence.
                </h2>
                <p className={styles.whyParagraph}>
                  Planning a milestone celebration involves dozens of critical decisions—from floral themes and
                  lighting acoustics to caterer selection and venue flow. Without structured guidance, hosts often
                  face unexpected budget overflows, miscommunicated vendor briefs, and avoidable festive stress.
                </p>
                <p className={styles.whyParagraph}>
                  An Eventsika consultation gives you a dedicated creative partner to structure your event,
                  anticipate logistical hurdles, and translate your personal celebration vision into an elegant,
                  actionable roadmap.
                </p>
                <p className={styles.whyParagraph}>
                  Already know what you need? Browse our{" "}
                  <Link href="/services">celebration services</Link> or compare{" "}
                  <Link href="/packages">decor packages priced per guest</Link>.
                </p>

                <ul className={styles.whyChecklist}>
                  {CHECKLIST_ITEMS.map((item) => (
                    <li key={item} className={styles.checklistItem}>
                      <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: Consultation Process Video with Tasteful Brand Mark */}
              <div className={styles.whyImageFrame}>
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  poster="/images/eventsika-consultation-poster.webp"
                  className={styles.whyVideo}
                  aria-label="Eventsika celebration consultation process video"
                >
                  <source
                    src="/videos/eventsika-consultation-process.mp4"
                    type="video/mp4"
                  />
                  Your browser does not support the video tag.
                </video>
                <div className={styles.videoBrandBug}>
                  <Image
                    src="/images/eventsika-official-logo.png"
                    alt="Eventsika - Celebrate Seamlessly"
                    width={108}
                    height={35}
                    className={styles.videoBrandLogo}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. How It Works Section */}
        <section className={styles.howSection} aria-labelledby="how-heading">
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <SeasonalDivider />
              <div className={styles.eyebrow}>SIMPLE 3-STEP PROCESS</div>
              <h2 id="how-heading" className={styles.sectionTitle}>
                How Your Consultation Unfolds
              </h2>
              <p className={styles.sectionSubtitle}>
                A straightforward, collaborative journey from your initial celebration concept to a finalized execution plan.
              </p>
            </div>

            <ol className={styles.stepsGrid}>
              {STEPS_DATA.map((item) => (
                <li key={item.step} className={styles.stepCard}>
                  <span className={styles.stepNumber}>{item.step}</span>
                  <h3 className={styles.stepTitle}>{item.title}</h3>
                  <p className={styles.stepDescription}>{item.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 6. Consultation Fee Card Section */}
        <section className={styles.pricingSection} aria-labelledby="pricing-heading">
          <div className={styles.container}>
            <div className={styles.pricingCardWrapper}>
              <div className={styles.pricingMasterCard}>
                <span className={styles.promoBadgeFloating}>
                  <StarAccent />
                  Signature Consultation
                </span>

                <h2 id="pricing-heading" className={styles.cardTitle}>
                  1-on-1 Celebration Planning Consultation
                </h2>
                <p className={styles.cardSubtitle}>
                  A dedicated 60-minute strategy session with our senior planning directors.
                </p>

                {/* Price Display */}
                <div className={styles.priceBlockCenter}>
                  <span className={styles.oneTimeFeeLabel}>Consultation Fee</span>
                  <div className={styles.dominantOfferPrice}>₹2,999</div>
                  <span className={styles.originalLabelText}>One-time fee · 60-minute session</span>
                </div>

                {/* Inclusions List */}
                <ul className={styles.inclusionsList}>
                  {INCLUSIONS_DATA.map((inc) => (
                    <li key={inc} className={styles.inclusionItem}>
                      <svg className={styles.inclusionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{inc}</span>
                    </li>
                  ))}
                </ul>

                {/* Card CTA (Interactive) */}
                <BookingTriggerButton
                  variant="card"
                  className={styles.cardCtaBtn}
                  ariaLabel="Book My Consultation for ₹2,999"
                />

                <p className={styles.cardDisclaimer}>
                  🔒 Secure checkout. Choose your preferred date and time while booking.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Testimonials Section */}
        <section className={styles.testimonialsSection} aria-labelledby="testimonials-heading">
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <div className={styles.eyebrow}>REAL EXPERIENCES</div>
              <h2 id="testimonials-heading" className={styles.sectionTitle}>
                What Our Hosts Say
              </h2>
              <p className={styles.sectionSubtitle}>
                Hear from clients who trusted Eventsika to guide and shape their most cherished milestones.
              </p>
            </div>

            <ul className={styles.testimonialsGrid}>
              {TESTIMONIALS_DATA.map((item) => (
                <li key={item.name} className={styles.testimonialCard}>
                  <div>
                    <div className={styles.starsRow} aria-label="5 out of 5 stars">
                      {"★★★★★"}
                    </div>
                    <blockquote className={styles.testimonialQuote}>
                      &ldquo;{item.quote}&rdquo;
                    </blockquote>
                  </div>
                  <div className={styles.authorBlock}>
                    <div className={styles.authorName}>{item.name}</div>
                    <div className={styles.authorCity}>{item.city}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 8. Final CTA Section */}
        <section className={styles.finalCtaSection} aria-labelledby="final-cta-heading">
          <div className={styles.container}>
            <div className={styles.finalCtaBox}>
              <div className={styles.finalEyebrow}>
                <PineSprig className={styles.finalSprig} />
                <span>CELEBRATE SEAMLESSLY</span>
                <PineSprig className={`${styles.finalSprig} ${styles.mirrored}`} />
              </div>

              <h2 id="final-cta-heading" className={styles.finalTitle}>
                Let&rsquo;s Create Beautiful Moments, Together.
              </h2>

              <p className={styles.finalDescription}>
                Great celebrations begin with a conversation. Book your consultation and start planning
                with total confidence.
              </p>

              <div className={styles.finalOfferPill}>
                Consultation Fee: <span className={styles.finalOfferHighlight}>₹2,999</span>
              </div>

              <div>
                <BookingTriggerButton
                  variant="final"
                  className={styles.finalCtaBtn}
                  ariaLabel="Reserve Your Consultation Today"
                />
              </div>

              <p className={styles.finalMicroNote}>
                Eventsika • Premium Celebration Architecture &amp; Event Management
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 9. Global Footer */}
      <Footer />
    </div>
    </BookingModalProvider>
  );
}

/* --------------------------------------------------------------------------
   Christmas-season accents: small, decorative, non-interactive inline SVGs.
   -------------------------------------------------------------------------- */

// Fir sprig: needle pairs on both sides of a straight stem from (4,28) to (28,4),
// angled toward the tip and shortening as they go. Alternate pairs use two
// muted greens for depth. Fixed geometry, so server and client markup match.
const STEM = { x: Math.SQRT1_2, y: -Math.SQRT1_2 }; // unit vector along the stem
const sprigNeedles = (parity: number) =>
  Array.from({ length: 10 }, (_, k) => k)
    .filter((k) => k % 2 === parity)
    .map((k) => {
      const x = 5.5 + k * 2.2;
      const y = 26.5 - k * 2.2;
      const len = 6.4 - k * 0.45;
      return [1, -1]
        .map((side) => {
          const a = side * 0.75; // ~43° off the stem
          const dx = (STEM.x * Math.cos(a) - STEM.y * Math.sin(a)) * len;
          const dy = (STEM.x * Math.sin(a) + STEM.y * Math.cos(a)) * len;
          return `M${x.toFixed(1)} ${y.toFixed(1)}l${dx.toFixed(2)} ${dy.toFixed(2)}`;
        })
        .join("");
    })
    .join("");
const SPRIG_NEEDLES_DEEP = sprigNeedles(0);
const SPRIG_NEEDLES_SOFT = sprigNeedles(1);

function PineSprig({ className, withBauble = false }: { className?: string; withBauble?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <path d={SPRIG_NEEDLES_DEEP} stroke="#3f5a4b" strokeWidth="1.3" strokeLinecap="round" />
      <path d={SPRIG_NEEDLES_SOFT} stroke="#6a8573" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4 28L28 4" stroke="#3a5345" strokeWidth="1.1" strokeLinecap="round" />
      {withBauble && (
        <>
          <path d="M12.5 21.5v4" stroke="#b99a67" strokeWidth="0.6" />
          <circle cx="12.5" cy="27.6" r="2.4" fill="#8e1d2b" />
          <circle cx="11.8" cy="26.8" r="0.7" fill="#f1c9cc" opacity="0.7" />
        </>
      )}
    </svg>
  );
}

function StarAccent() {
  return (
    <svg className={styles.starAccent} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M6 0.8 7 5 11.2 6 7 7 6 11.2 5 7 0.8 6 5 5Z" fill="currentColor" />
    </svg>
  );
}

function SeasonalDivider() {
  return (
    <div className={styles.seasonalDivider} aria-hidden="true">
      <span className={styles.badgeLine} />
      <PineSprig className={styles.dividerSprig} />
      <span className={styles.badgeLine} />
    </div>
  );
}
