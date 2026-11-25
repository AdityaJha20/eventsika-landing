import Image from "next/image";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Services from "../components/Services";
import EventTypes from "../components/EventTypes";
import Packages from "../components/Packages";
import ForVendors from "../components/ForVendors";
import Footer from "../components/Footer";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div>
      <Navbar />
      <main>
        <Hero />
        <section className={styles.videoHero} aria-label="Eventsika decor packages film">
          <div className={styles.videoFrame}>
            <video
              autoPlay
              muted
              loop
              playsInline
              controls={false}
              preload="metadata"
              poster="/images/eventsika-packages-film-poster.webp"
              className={styles.heroVideo}
              aria-hidden="true"
              tabIndex={-1}
            >
              <source src="/videos/eventsika-packages-film.mp4" type="video/mp4" />
            </video>
            <Image
              src="/images/eventsika-packages-film-poster.webp"
              alt="Eventsika Essential, Premium and Luxury decor packages, priced per guest"
              fill
              sizes="(max-width: 1140px) 100vw, 1100px"
              className={styles.heroPoster}
            />
          </div>
        </section>
        <Services />
        <EventTypes />
        <Packages />
        <ForVendors />
      </main>
      <Footer />
    </div>
  );
}
