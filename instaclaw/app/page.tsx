import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Comparison } from "@/components/landing/comparison";
import { UseCases } from "@/components/landing/use-cases";
import { Features } from "@/components/landing/features";
import { Pricing } from "@/components/landing/pricing";
import { FAQ } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <main
      data-theme="landing"
      style={{
        '--background': '#f8f7f4',
        '--foreground': '#333334',
        '--muted': '#6b6b6b',
        '--card': '#ffffff',
        '--border': 'rgba(0, 0, 0, 0.1)',
        '--accent': '#2b5e49',
        background: '#f8f7f4',
        color: '#333334',
      } as React.CSSProperties}
    >
      <Hero />
      <HowItWorks />
      <Comparison />
      <UseCases />
      <Features />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}
