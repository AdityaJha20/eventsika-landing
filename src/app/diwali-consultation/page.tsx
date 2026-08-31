import type { Metadata } from "next";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import styles from "./diwali-consultation.module.css";

export const metadata: Metadata = {
  title: "Diwali Special Offer | 1-on-1 Event Planning Consultation",
  description:
    "Book an exclusive 1-on-1 celebration planning consultation with Eventsika's lead creative planners at our special Diwali promotional price of ₹2,999 (Regular ₹5,000). Limited-time offer.",
  alternates: {
    canonical: "/diwali-consultation",
  },
  openGraph: {
    title: "Diwali Special Offer | Event Planning Consultation | Eventsika",
    description:
      "Diwali Special Offer: Book an expert 1-on-1 event planning consultation at ₹2,999 instead of ₹5,000. Plan with clarity, celebrate with confidence.",
    url: "https://eventsika.in/diwali-consultation",
    type: "website",
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
      "The consultation transformed how we approached our home Diwali gala. The team gave us exact floral and lighting vendor recommendations that fit our budget perfectly without cutting corners.",
    name: "Priya & Anand Sharma",
    city: "New Delhi",
  },
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

export default function DiwaliConsultationPage() {
  return (
    <div className={styles.pageWrapper}>
      {/* 1. Global Navigation */}
      <Navbar />

      <main id="main-content">
        {/* 2. Diwali Offer Hero Section */}
        <section className={styles.heroSection} aria-labelledby="diwali-hero-heading">
          <div className={styles.container}>
            <div className={styles.heroGrid}>
              {/* Left Column: Offer Details & Typography */}
              <div className={styles.heroContent}>
                {/* Diwali Offer Badge Framed by Symmetrical Diyas & Decorative Lines */}
                <div className={styles.heroBadgeWrapper}>
                  <span className={styles.badgeLine} aria-hidden="true" />
                  <DiyaIcon className={styles.badgeDiya} />
                  <span className={styles.heroEyebrow}>DIWALI SPECIAL OFFER</span>
                  <DiyaIcon className={styles.badgeDiya} />
                  <span className={styles.badgeLine} aria-hidden="true" />
                </div>

                <h1 id="diwali-hero-heading" className={styles.heroTitle}>
                  Your Celebration<br />
                  Deserves a <span className={styles.heroTitleHighlight}>Brighter Beginning.</span>
                </h1>

                <p className={styles.heroDescription}>
                  This festive season, bring clarity, artistry, and seamless coordination to your celebration.
                  Book an exclusive one-on-one consultation with our lead event architects at a limited-time
                  promotional rate.
                </p>

                {/* Hero Pricing Box */}
                <div className={styles.heroPricingBox}>
                  <div className={styles.pricingHeaderRow}>
                    <span className={styles.pricingBadge}>DIWALI SPECIAL</span>
                    <span className={styles.urgencyTag}>
                      <span>⭐</span>
                      <span>Limited-time Diwali offer</span>
                    </span>
                  </div>

                  <div className={styles.priceDisplayGroup}>
                    <div className={styles.originalPriceWrapper}>
                      <span className={styles.originalPriceLabel}>Original Price</span>
                      <span className={styles.originalPrice}>₹5,000</span>
                    </div>

                    <div className={styles.offerPriceWrapper}>
                      <span className={styles.offerPriceLabel}>Diwali Offer Price</span>
                      <span className={styles.offerPrice}>₹2,999</span>
                    </div>
                  </div>

                  <p className={styles.pricingTerms}>
                    Diwali Special Offer — Comprehensive 1-on-1 Consultation at ₹2,999 instead of ₹5,000.
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

                  <button
                    type="button"
                    className={styles.primaryCtaBtn}
                    aria-label="Book My Consultation for ₹2,999"
                  >
                    <span>Book My Consultation — ₹2,999</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                  <span className={styles.ctaTrustNote}>
                    ✓ 100% Dedicated Session • No Hidden Fees • Tailored Celebration Blueprint
                  </span>
                </div>
              </div>

              {/* Right Column: Premium Diwali Image */}
              <div className={styles.heroImageColumn}>
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

        {/* 6. Promotional Price Card Section */}
        <section className={styles.pricingSection} aria-labelledby="pricing-heading">
          <div className={styles.container}>
            <div className={styles.pricingCardWrapper}>
              <div className={styles.pricingMasterCard}>
                <span className={styles.promoBadgeFloating}>DIWALI SPECIAL</span>

                <h2 id="pricing-heading" className={styles.cardTitle}>
                  1-on-1 Celebration Planning Consultation
                </h2>
                <p className={styles.cardSubtitle}>
                  A dedicated 60-minute strategy session with our senior planning directors.
                </p>

                {/* Price Display */}
                <div className={styles.priceBlockCenter}>
                  <div className={styles.strikethroughOriginal}>₹5,000</div>
                  <span className={styles.originalLabelText}>Original Consultation Price</span>
                  <div className={styles.dominantOfferPrice}>₹2,999</div>
                  <span className={styles.oneTimeFeeLabel}>ONE-TIME CONSULTATION FEE</span>
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

                {/* Card CTA (Inert / Visual) */}
                <button
                  type="button"
                  className={styles.cardCtaBtn}
                  aria-label="Book My Consultation for ₹2,999"
                >
                  <span>Book My Consultation — ₹2,999</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>

                <p className={styles.cardDisclaimer}>
                  🔒 Limited seasonal slots available for Diwali &amp; upcoming winter celebrations.
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

        {/* 8. Final Diwali CTA Section */}
        <section className={styles.finalCtaSection} aria-labelledby="final-cta-heading">
          <div className={styles.container}>
            <div className={styles.finalCtaBox}>
              <div className={styles.finalEyebrow}>
                <span>✨</span>
                <span>CELEBRATE SEAMLESSLY</span>
                <span>✨</span>
              </div>

              <h2 id="final-cta-heading" className={styles.finalTitle}>
                Let&rsquo;s Create Beautiful Moments, Together.
              </h2>

              <p className={styles.finalDescription}>
                Great celebrations begin with a conversation. Take advantage of our Diwali promotional rate
                and start planning with total confidence.
              </p>

              <div className={styles.finalOfferPill}>
                Diwali Special: <span className={styles.finalOfferHighlight}>₹2,999</span> (Regular ₹5,000)
              </div>

              <div>
                <button
                  type="button"
                  className={styles.finalCtaBtn}
                  aria-label="Reserve Your Consultation Today"
                >
                  <span>Reserve Your Consultation Today</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
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
  );
}

function DiyaIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer Flame */}
      <path
        d="M12 2C12 2 9.5 5.5 9.5 8C9.5 9.38 10.62 10.5 12 10.5C13.38 10.5 14.5 9.38 14.5 8C14.5 5.5 12 2 12 2Z"
        fill="#E5A93C"
      />
      {/* Inner Flame Glow */}
      <path
        d="M12 4.5C12 4.5 10.8 6.5 10.8 7.8C10.8 8.46 11.34 9 12 9C12.66 9 13.2 8.46 13.2 7.8C13.2 6.5 12 4.5 12 4.5Z"
        fill="#FFF3C4"
      />
      {/* Diya Brass Bowl */}
      <path
        d="M4 11C4 11 5 17 12 17C19 17 20 11 20 11H4Z"
        fill="#B99A67"
        stroke="#8C6D3B"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Diya Base Stand */}
      <path
        d="M9 17L8 20H16L15 17"
        stroke="#8C6D3B"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
