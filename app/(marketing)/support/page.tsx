import type { Metadata } from "next";
import Link from "next/link";
import { PRICING_TIERS } from "@/lib/pricing";

export const metadata: Metadata = {
  alternates: { canonical: "/support" },
  openGraph: { url: "/support" },
  title: "Support",
  description: "Get help with Place & Plenty — account, subscription, and technical support.",
};

// THE V1 SUPPORT FAQ — DELIBERATELY SHORT.
//
// Founder instruction, 28 Aug 2026: keep it concise, and keep it to the
// questions that reduce sign-up and purchase friction. Not a knowledge
// base, and not a second copy of the pages it links to.
//
// The ten it covers, in the order someone actually hits them:
// web vs app · bring-your-own invitations · RSVPs · Who's Bringing What ·
// My People vs My Guest Book · Free vs Pass vs Plus · cross-platform
// entitlements · co-host access · billing · deleting an account.
//
// WHAT WAS REMOVED AND WHY. "How do I create my first gathering",
// "what does HostReady measure" and "I'm having a technical issue" are
// product tutorials and a contact prompt, not friction. The contact
// route is already the first thing on this page. Anything explained in
// full elsewhere is LINKED rather than restated — a duplicated answer is
// an answer that will eventually contradict its original.

const faqs = [
  {
    q: "Do I have to download the app?",
    a: "No. You can create an account, plan and run your whole gathering in the browser — menu, people, shopping, contributions and your HostReady score. The app is there for gathering day and for planning from the sofa, not as a step you have to take first.",
  },
  {
    q: "I already made my invitations somewhere else. Can I still use this?",
    a: "Yes, and this is one of the main reasons people switch. Bring the artwork you made on Canva, bought on Etsy, sent on Paperless Post or already printed and posted — or bring nothing at all. Place & Plenty begins at “people are coming”, not at the invitation.",
  },
  {
    q: "How do RSVPs work?",
    a: "Guests reply from their invitation link without needing an account. Their answer lands on the actual guest record in My People, alongside their household, dietary notes and anything they said they would bring — not in a separate form you then have to copy across.",
  },
  {
    q: "How does Who’s Bringing What work?",
    a: "You say what is needed, guests claim what they are bringing, and it all sits on the same gathering. No parallel spreadsheet and no four separate texts about the same casserole.",
  },
  {
    q: "What’s the difference between My People and My Guest Book?",
    a: "My People is the guest list for one gathering. My Guest Book is your reusable list of the people you host most often, kept at the account level — so the next gathering does not start from an empty page.",
  },
  {
    q: "What do I get for free, and what do the paid plans add?",
    a: `Free covers one active gathering at a time. A Gathering Pass is ${PRICING_TIERS[1].priceLine} and unlocks one gathering, staying with it. Plus is ${PRICING_TIERS[2].priceLine} and covers up to 6 active gatherings at once and up to 12 locked-in per year. Full detail is on the Pricing page.`,
  },
  {
    q: "If I buy on my phone, do I still have it on the web?",
    a: "Yes, and the other way round. What you buy attaches to your Place & Plenty account rather than to a device or a store, so a Pass or Plus bought through Apple or Google works on the web, and one bought on the web works in the app. Nothing to repurchase and nothing to transfer.",
  },
  {
    q: "If I buy Plus on the web, is anything still app-only?",
    a: "Yes, two things. Host Mode and Space Mode need the mobile app — Host Mode runs on gathering-day notifications while you are moving around the house, and Space Mode starts with a camera pointed at a room. Your Plus access follows your account either way, but feature availability varies between web and mobile, so you would need the app to use those two.",
  },
  {
    q: "Can someone help me host without seeing everything?",
    a: "Yes. Invite them as a co-host on that gathering and they get access to that gathering only — not to your other gatherings, your Guest Book or your account.",
  },
  {
    q: "Where do I manage or cancel what I’ve bought?",
    a: "Wherever you bought it. A purchase made on placeandplenty.com is managed in your account here. One made through the App Store or Google Play is managed in that store, because those are the only places it can be changed or cancelled.",
  },
  {
    q: "How do I delete my account?",
    a: "In the app under Settings → Delete my account, or by email if you no longer have it installed. The Delete Account page below sets out both routes and exactly what is removed and what is kept.",
  },
];

export default function SupportPage() {
  return (
    <section className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto max-w-prose px-6">
        <h1 className="font-display text-4xl text-forest">Support</h1>
        <p className="mt-4 font-body text-lg text-forest/80">
          Have a question about Place &amp; Plenty? Reach us at{" "}
          <a
            href="mailto:support@placeandplenty.com"
            className="underline decoration-gold underline-offset-4"
          >
            support@placeandplenty.com
          </a>
          .
        </p>

        <h2 className="mt-12 font-display text-2xl text-forest">
          Frequently asked questions
        </h2>
        <dl className="mt-6 divide-y divide-sage/30">
          {faqs.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="font-body font-semibold text-forest">
                {item.q}
              </dt>
              <dd className="mt-2 font-body text-sm leading-relaxed text-forest/70">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-12 rounded-card border border-sage/30 bg-cream p-6">
          <p className="font-body text-sm text-forest/80">
            Want to delete your account?{" "}
            <Link
              href="/delete-account"
              className="underline decoration-gold underline-offset-4"
            >
              See instructions here
            </Link>
            . Read our{" "}
            <Link href="/privacy" className="underline decoration-gold underline-offset-4">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="underline decoration-gold underline-offset-4">
              Terms of Use
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
