import { BackgroundFX } from "@/components/BackgroundFX";
import { Faq } from "@/components/sections/Faq";
import { Features } from "@/components/sections/Features";
import { Footer } from "@/components/sections/Footer";
import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Platforms } from "@/components/sections/Platforms";

export default function App() {
  return (
    <>
      <BackgroundFX />
      <Header />
      <main>
        <Hero />
        <Platforms />
        <Features />
        <HowItWorks />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
