import type { Metadata } from "next";
import SearchLandingPage from "@/components/SearchLandingPage";

export const metadata: Metadata = {
  title: "Potluck Planner & Who’s Bringing What List",
  description:
    "Organize a potluck with invitations, RSVPs and a Who’s Bringing What list. Assign useful slots, prevent duplicates and keep the menu connected.",
  alternates: { canonical: "/potluck-planner" },
  openGraph: {
    title: "Potluck Planner & Who’s Bringing What List | Place & Plenty",
    description: "Ask for what the table needs—not just another side.",
    url: "/potluck-planner",
  },
};

const faqs = [
  { q: "How do I organize who brings what to a potluck?", a: "Start with useful slots—such as two vegetables, one starch, bread, desserts, ice and drinks—then let guests claim or receive a contribution connected to the same gathering." },
  { q: "How do I prevent duplicate potluck dishes?", a: "Make the open and claimed contributions visible in one list. Specific categories work better than asking everyone to bring any side." },
  { q: "Can I use the potluck list with invitations and RSVPs?", a: "Yes. Place & Plenty keeps invitations, attendance and contributions attached to the same people and gathering." },
  { q: "What should the host provide for a potluck?", a: "The host should usually keep the dishes that set the timing, travel badly or need the oven, plus a small backup for essentials such as ice, serving utensils and drinks." },
];

export default function PotluckPlannerPage() {
  return (
    <SearchLandingPage
      path="/potluck-planner"
      eyebrow="Potluck planner"
      headline="Ask for what the table needs."
      emphasisLine="See who is bringing it."
      intro="A potluck should spread the work, not scatter the plan across forty messages. Place & Plenty keeps invitations, RSVPs, the menu and Who’s Bringing What together."
      heroImage="/images/article-how-to-organise-a-potluck.png"
      heroImageAlt="Friends arriving with shared dishes for a relaxed potluck in a warm home"
      distinction="The fix is not a better group chat."
      distinctionBody="Ask for specific contribution slots, keep oven-dependent dishes with the host and let everyone see what is claimed. The result is a real menu—not four potato dishes and a mystery dessert."
      steps={[
        { title: "Shape the menu", body: "Decide what the table needs before handing every decision to the guests." },
        { title: "Create useful slots", body: "Ask for a green vegetable, bread, ice or dessert for a number of people—not simply ‘a side.’" },
        { title: "Connect people and dishes", body: "Keep each contribution with the guest who claimed it and the gathering it belongs to." },
        { title: "Protect the oven", body: "Know what arrives hot, cold or ready to serve before four dishes need the same twenty minutes at different temperatures." },
      ]}
      features={[
        { icon: "dish", title: "One visible menu", body: "See the host’s dishes and guest contributions as parts of the same table." },
        { icon: "check", title: "Open and claimed slots", body: "Know what is covered and what still needs a person." },
        { icon: "people", title: "Guest-level assignments", body: "Keep the dish connected to the person bringing it." },
        { icon: "clock", title: "Timing awareness", body: "Plan around travel, serving temperature and the one oven everyone assumes is available." },
        { icon: "cart", title: "Host shopping", body: "Turn what remains with the host into a practical list." },
        { icon: "rsvp", title: "RSVP connection", body: "See attendance and contributions together instead of reconciling two different systems." },
      ]}
      proofHeading="Designed for the way people actually gather and contribute."
      proofBody="Potlucks are generous, slightly unpredictable and usually managed by one person who can still see every missing piece. Place & Plenty gives that host enough structure to share the work without trying to control every casserole."
      faqs={faqs}
      related={[
        { href: "/coordinated-host/how-to-organise-a-potluck", label: "Potluck Without a Group Chat", description: "The practical rules behind a potluck that actually works." },
        { href: "/gathering-ideas/friendsgiving-before-everyones-calendar-fills-up", label: "Friendsgiving Plan", description: "Build the date, menu, contributions and seating before the calendar closes." },
        { href: "/rsvp-and-guest-list", label: "RSVP & Guest List", description: "Keep every contribution connected to the person bringing it." },
      ]}
    />
  );
}
