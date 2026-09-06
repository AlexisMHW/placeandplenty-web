import type { Metadata } from "next";
import invitationVisual from "../../../homepage/product-invitations.png";
import SearchLandingPage from "@/components/SearchLandingPage";

export const metadata: Metadata = {
  title: "Online Party Invitations with RSVP Planning",
  description:
    "Create a party invitation or bring one from Canva, Etsy or elsewhere. Track RSVPs, guests, dietary needs and everything the yes sets in motion.",
  alternates: { canonical: "/invitations" },
  openGraph: {
    title: "Online Party Invitations with RSVP Planning | Place & Plenty",
    description:
      "Send the invitation, know who is coming and keep planning after they say yes.",
    url: "/invitations",
  },
};

const faqs = [
  {
    q: "Can I create an online invitation in Place & Plenty?",
    a: "Yes. You can create a simple invitation connected to your gathering, guest list and RSVP flow.",
  },
  {
    q: "Can I use an invitation I made in Canva or bought on Etsy?",
    a: "Yes. Bring the artwork you already have and use Place & Plenty for the guest list, RSVPs, contributions and the rest of the gathering plan.",
  },
  {
    q: "Do guests need the app to RSVP?",
    a: "No. Guests can open the invitation link and respond in their browser without downloading the app or creating a host account.",
  },
  {
    q: "What can I ask guests when they RSVP?",
    a: "You can keep the response tied to the actual guest or household and gather the practical information the host needs, including attendance and dietary details.",
  },
];

export default function InvitationsPage() {
  return (
    <SearchLandingPage
      path="/invitations"
      eyebrow="Online party invitations"
      headline="The invitation starts it."
      emphasisLine="The plan keeps going."
      intro="Create an invitation here, upload the one you already love, or keep using the invitation you sent elsewhere. Place & Plenty connects the people who say yes to the food, contributions, shopping and readiness that come next."
      heroImage={invitationVisual.src}
      heroImageAlt="Place & Plenty invitation and RSVP planning shown on a laptop and phone in a warm home"
      distinction="Most invitation tools stop when the guest says yes."
      distinctionBody="Place & Plenty helps you handle everything that yes creates: another plate at the table, a dietary need, a contribution, a changed shopping list and one more person to welcome well."
      steps={[
        { title: "Create or bring the invitation", body: "Use a Place & Plenty invitation or bring artwork made in Canva, purchased on Etsy or designed somewhere else." },
        { title: "Invite your people", body: "Keep names, households and the details for this gathering together in My People." },
        { title: "Know who is coming", body: "Responses land against the guest list, with plus-ones and dietary needs where the host can use them." },
        { title: "Plan what the yes changes", body: "Carry the count into the menu, contributions, shopping and the work still left before the doorbell rings." },
      ]}
      features={[
        { icon: "envelope", title: "Your invitation, your way", body: "Start here or bring an existing design. A pretty invitation should never trap the rest of the plan somewhere else." },
        { icon: "rsvp", title: "Connected RSVPs", body: "See yes, maybe and no responses without rebuilding the guest list in a spreadsheet." },
        { icon: "people", title: "Households and guests", body: "Keep the people coming together, including plus-ones and the details that matter to the host." },
        { icon: "dish", title: "Dietary information", body: "Collect useful food information early enough for it to shape the menu." },
        { icon: "check", title: "Who’s Bringing What", body: "Coordinate contributions against the same gathering instead of reconstructing them from a group chat." },
        { icon: "book", title: "My Guest Book", body: "Keep the people you host most often in one place, ready for the next gathering." },
      ]}
      proofHeading="Made for the host carrying the whole gathering—not only the invitation."
      proofBody="Place & Plenty was built by Alexis Hughes-Williams, a Nashville entrepreneur, marketer, baker, mother and real-life host who needed one place to carry the invisible work before people arrived."
      faqs={faqs}
      related={[
        { href: "/rsvp-and-guest-list", label: "RSVP & Guest List", description: "See how invitations become a usable guest plan." },
        { href: "/party-planning-app", label: "Party Planning App", description: "Plan the food, shopping, space and timing around the people coming." },
        { href: "/coordinated-host/how-to-track-rsvps-without-chasing-everyone", label: "How to Track RSVPs", description: "A practical guide to getting answers without becoming the reminder department." },
      ]}
    />
  );
}
