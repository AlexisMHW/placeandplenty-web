import Hero from "@/components/Hero";
import ProblemSection from "@/components/ProblemSection";
import HowItWorks from "@/components/HowItWorks";
import HostReadySection from "@/components/HostReadySection";
import ClosetSection from "@/components/ClosetSection";
import FeatureGrid from "@/components/FeatureGrid";
import UseCaseSection from "@/components/UseCaseSection";
import CoordinatedHostTeaser from "@/components/CoordinatedHostTeaser";
import PhilosophySection from "@/components/PhilosophySection";
import CtaSection from "@/components/CtaSection";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <HostReadySection />
      <ClosetSection />
      <FeatureGrid />
      <UseCaseSection />
      <CoordinatedHostTeaser />
      <PhilosophySection />
      <CtaSection />
    </>
  );
}
