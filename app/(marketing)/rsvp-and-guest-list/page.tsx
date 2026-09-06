import type { Metadata } from "next";
import SearchLandingPage from "@/components/SearchLandingPage";

export const metadata: Metadata = {
  title: "Online RSVP Tracker & Guest List Manager",
  description:
    "Track party RSVPs, households, plus-ones, dietary needs and contributions in one guest list that remains connected to the gathering plan.",
  alternates: { canonical: "/rsvp-and-guest-list" },
  openGraph: {
    title: "Online RSVP Tracker & Guest List Manager | Place & Plenty",
    description: "Your RSVP should help you plan—not create another list to manage.",
    url: "/rsvp-and-guest-list",
  },
};

const faqs = [
  { q: "Can guests RSVP without downloading an app?", a: "Yes. A guest can open the invitation link and respond in a browser without becoming a Place & Plenty host." },
  { q: "Can I track families or households together?", a: "Yes. The guest workflow is designed around the way people actually decide and attend, including household responses and plus-ones." },
  { q: "Can RSVPs include dietary needs?", a: "Yes. Dietary information stays connected to the guest and gathering so it can inform the menu instead of sitting unread in a separate form." },
  { q: "What is the difference between My People and My Guest Book?", a: "My People is the guest list for one gathering. My Guest Book keeps the people you host most often available for future gatherings, so you do not rebuild the same list every time." },
];

export default function RsvpGuestListPage() {
  return (
    <SearchLandingPage
      path="/rsvp-and-guest-list"
      eyebrow="RSVP tracker and guest list"
      headline="Your guest count changed."
      emphasisLine="Your plan should know."
      intro="Keep invitations, responses, households, dietary information and contributions tied to the actual people coming. No parallel spreadsheet. No rebuilding the list after every reply."
      heroImage="/images/what-it-does-my-people.png"
      heroImageAlt="Place & Plenty My People guest planning screen in a warm home setting"
      distinction="An RSVP is planning information—not the end of the invitation."
      distinctionBody="When another person says yes, the host may need another chair, another serving, a menu adjustment and a different shopping total. Place & Plenty keeps that response connected to the gathering it changes."
      steps={[
        { title: "Build My People", body: "Add the guests and households for this particular gathering." },
        { title: "Share one clear invitation", body: "Guests receive a link they can open and answer without becoming a host or downloading an app." },
        { title: "Collect usable answers", body: "Track attendance, plus-ones and dietary information against the right person." },
        { title: "Keep your people", body: "Save the people you host most often in My Guest Book so the next gathering does not begin from zero." },
      ]}
      features={[
        { icon: "rsvp", title: "Yes, maybe and no", body: "See the response picture without searching texts, email threads and comments." },
        { icon: "users", title: "Household responses", body: "Keep families and shared invitations together in the way people actually attend." },
        { icon: "dish", title: "Dietary needs", body: "Carry food information into the plan early enough to make a difference." },
        { icon: "check", title: "Contributions", body: "See who claimed what and what the gathering still needs." },
        { icon: "chat", title: "Guest updates", body: "Keep gathering information anchored to the same guest experience instead of starting another thread." },
        { icon: "book", title: "Reusable contacts", body: "Invite familiar people again without turning Place & Plenty into a complicated CRM." },
      ]}
      proofHeading="The people are not a list beside the plan. They are why the plan exists."
      proofBody="Place & Plenty begins with the gathering and keeps every guest response close to its practical consequence. That makes the guest list useful to the host before the gathering and convenient again the next time people are coming over."
      faqs={faqs}
      related={[
        { href: "/invitations", label: "Online Invitations", description: "Create an invitation or bring the design you already have." },
        { href: "/potluck-planner", label: "Potluck Planner", description: "Connect the people coming with what they agreed to bring." },
        { href: "/coordinated-host/how-to-track-rsvps-without-chasing-everyone", label: "RSVP Guide", description: "Set a response rhythm that gets answers without constant chasing." },
      ]}
    />
  );
}
