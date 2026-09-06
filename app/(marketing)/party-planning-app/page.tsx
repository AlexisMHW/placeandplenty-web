import type { Metadata } from "next";
import SearchLandingPage from "@/components/SearchLandingPage";

export const metadata: Metadata = {
  title: "Party Planning App for Real-Life Hosts",
  description:
    "Plan an at-home party with invitations, guests, menus, shopping, contributions, space and a live HostReady score in one connected place.",
  alternates: { canonical: "/party-planning-app" },
  openGraph: {
    title: "Party Planning App for Real-Life Hosts | Place & Plenty",
    description: "Everything between people are coming and the doorbell ringing.",
    url: "/party-planning-app",
  },
};

const faqs = [
  { q: "What does a party planning app help with?", a: "Place & Plenty connects the guest list, invitations, menu, shopping, contributions, space and preparation timeline so a change in one part of the gathering does not disappear from the rest of the plan." },
  { q: "Is Place & Plenty for professional event planners?", a: "No. It is designed for people hosting real gatherings at home: birthdays, holidays, dinners, game days, showers, potlucks and the occasions that happen in ordinary life." },
  { q: "Can I plan from a computer?", a: "Yes. Most planning works in your browser, and the same account and gathering can continue on your phone when the apps are available." },
  { q: "Can I start planning for free?", a: "Yes. Free covers one active gathering at a time, so you can experience the connected planning workflow before deciding whether you need a Gathering Pass or Plus." },
];

export default function PartyPlanningAppPage() {
  return (
    <SearchLandingPage
      path="/party-planning-app"
      eyebrow="Party planning app"
      headline="Everything the gathering needs."
      emphasisLine="Without five different lists."
      intro="Place & Plenty is a home party planning app for the person carrying the invitations, people, food, shopping, space and timing. It turns the whole run-up into one connected plan you can actually use."
      heroImage="/images/hero-tabletop.jpg"
      heroImageAlt="A warm, lived-in table prepared for an at-home gathering"
      distinction="Party planning should make the day feel lighter."
      distinctionBody="This is not professional event software squeezed into your home. It is a calm, practical place for the real work of getting ready for birthdays, holidays, dinners, potlucks, showers and people coming over."
      steps={[
        { title: "Tell us what is happening", body: "Start with the occasion, date, time, place and number of people you expect." },
        { title: "Bring in your people", body: "Create or attach the invitation, build the guest list and see who is coming." },
        { title: "Plan the gathering", body: "Shape the menu, quantities, shopping, contributions, budget, space and help." },
        { title: "Know what is next", body: "Use Next Up and HostReady to focus on the work that matters now instead of staring at the whole plan." },
      ]}
      features={[
        { icon: "sparkle", title: "Figure It Out for Me", body: "Turn the basics of your gathering into a useful starting plan, menu and timeline." },
        { icon: "table", title: "My Table", body: "Plan dishes, servings, dietary needs and how the food will actually reach the table." },
        { icon: "cart", title: "My Shopping", body: "Keep purchases and spending connected so the list reflects the gathering you are really having." },
        { icon: "closet", title: "My Hosting Closet", body: "Remember what you already own before buying another serving bowl." },
        { icon: "gauge", title: "HostReady™", body: "See a weighted readiness score based on the work that genuinely affects the gathering." },
        { icon: "clock", title: "Host Mode", body: "On the day, see what matters right now instead of carrying the entire plan at once." },
      ]}
      proofHeading="Built around real homes, real schedules and real people."
      proofBody="A gathering can be six people in an apartment or sixty people filling a backyard. Place & Plenty does not require matching dishes, professional décor or a perfect house. It helps the host make a workable plan for the home and people they actually have."
      faqs={faqs}
      related={[
        { href: "/coordinated-host/complete-at-home-party-planning-checklist", label: "Party Planning Checklist", description: "A complete sequence from choosing the date through the first knock at the door." },
        { href: "/gathering-ideas", label: "Gathering Ideas", description: "Start with a real occasion, menu, quantities and practical preparation." },
        { href: "/what-it-does", label: "Everything It Does", description: "Explore the full connected home-hosting system." },
      ]}
    />
  );
}
