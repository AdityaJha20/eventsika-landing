import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import HowItWorks from "../components/HowItWorks";
import Services from "../components/Services";
import EventTypes from "../components/EventTypes";
import Packages from "../components/Packages";
import ForVendors from "../components/ForVendors";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Services />
        <EventTypes />
        <Packages />
        <ForVendors />
      </main>
      <Footer />
    </div>
  );
}
