import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BookingStatusClient } from "./BookingStatusClient";

export const metadata: Metadata = {
  title: "Booking status | Eventsika",
  description: "Check the status of your Eventsika consultation payment and booking.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ConsultationStatusPage() {
  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "120px 16px 64px" }}>
        <BookingStatusClient />
      </main>
      <Footer />
    </>
  );
}
