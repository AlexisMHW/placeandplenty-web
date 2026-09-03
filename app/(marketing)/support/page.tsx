import type { Metadata } from "next";
import Link from "next/link";
import { PRICING_TIERS } from "@/lib/pricing";
import { REFUND_POLICY } from "@/lib/refund-policy";
import { Band, Display } from "@/components/Display";

export const metadata: Metadata = {
  alternates: { canonical: "/support" },
  openGraph: { url: "/support" },
  title: "Support",
  description: "Get help with Place & Plenty — gatherings, account, billing, cancellations and technical support.",
};

const planningQuestions = [
  {
    q: "Do I have to download the app?",
    a: "No. You can create an account and do your core planning in the browser. The mobile app adds the gathering-day and device-specific parts of Place & Plenty, including Host Mode and Space Mode.",
  },
  {
    q: "I already made my invitations somewhere else. Can I still use this?",
    a: "Absolutely. Bring the invitation you made on Canva, bought on Etsy, sent somewhere else, or already printed. Place & Plenty begins with the gathering, not with forcing you to make another invitation.",
  },
  {
    q: "What’s the difference between My People and My Guest Book?",
    a: "My People is the guest list for one gathering. My Guest Book is your reusable account-level list of the people you host most often, so your next gathering does not begin from an empty page.",
  },
];

const peopleQuestions = [
  {
    q: "How do RSVPs work?",
    a: "Guests respond from their invitation link without needing an account. Their response stays with the same guest record in My People, alongside household and gathering details.",
  },
  {
    q: "How does Who’s Bringing What work?",
    a: "You say what is needed, guests claim what they are bringing, and it stays attached to the gathering. No parallel spreadsheet and no four texts about the same casserole.",
  },
  {
    q: "Can someone help me host without seeing everything?",
    a: "Yes. A co-host gets access to that gathering, not to your other gatherings, My Guest Book, or the rest of your account.",
  },
];

const billingQuestions = [
  {
    q: "What do I get for free, and what do the paid plans add?",
    a: `Free gives you one open gathering. A Gathering Pass is ${PRICING_TIERS[1].priceLine} for one gathering. Plus is ${PRICING_TIERS[2].priceLine}, with up to 6 open gatherings at once and up to 12 locked-in gatherings per annual term.`,
  },
  {
    q: "If I buy on my phone, do I still have it on the web?",
    a: "Yes, and the other way around. Paid access belongs to your Place & Plenty account, not to a device. Sign in with the same account and the entitlement follows you.",
  },
  {
    q: "What happens if I cancel Plus?",
    a: REFUND_POLICY.plus.short,
  },
  {
    q: "Can I get a refund?",
    a: `${REFUND_POLICY.gatheringPass.short} ${REFUND_POLICY.initialPlusRefund}`,
  },
  {
    q: "Where do I manage what I bought?",
    a: "Apple and Google purchases are managed in the store where you bought them. Purchases made directly on placeandplenty.com are managed through your Place & Plenty account.",
  },
];

function QuestionGroup({
  eyebrow,
  title,
  questions,
}: {
  eyebrow: string;
  title: string;
  questions: { q: string; a: string }[];
}) {
  return (
    <section className="border-t border-sage/25 py-10 first:border-t-0 first:pt-0">
      <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.2em] text-forest/55">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl text-forest md:text-[1.85rem]">{title}</h2>
      <dl className="mt-6 space-y-7">
        {questions.map((item) => (
          <div key={item.q}>
            <dt className="font-display text-lg leading-snug text-forest">{item.q}</dt>
            <dd className="mt-2 font-body text-[0.98rem] leading-relaxed text-forest/72">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function SupportPage() {
  return (
    <>
      <Band tone="parchment">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-end">
            <div>
              <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">Support</p>
              <Display as="h1" emphasis="together" className="mt-4 text-4xl leading-[1.08] text-forest md:text-5xl">
                When something needs sorting, we’ll sort it together.
              </Display>
              <p className="mt-5 max-w-2xl font-body text-lg leading-relaxed text-forest/78">
                Start here for the things hosts ask most. If the answer is specific to your account or something simply is not behaving, send us a note and a real person can pick it up from there.
              </p>
            </div>

            <div className="rounded-2xl border border-gold/40 bg-cream px-6 py-6 shadow-sm">
              <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-forest/55">Need a hand?</p>
              <p className="mt-3 font-display text-xl text-forest">Write to Place &amp; Plenty</p>
              <a
                href="mailto:support@placeandplenty.com"
                className="mt-5 inline-flex border-b border-gold pb-1 font-body text-sm font-bold uppercase tracking-[0.12em] text-forest"
              >
                support@placeandplenty.com
              </a>
              <p className="mt-4 font-body text-sm leading-relaxed text-forest/65">
                For billing questions, include the email on your P&amp;P account and where you made the purchase. Never send card numbers or passwords.
              </p>
            </div>
          </div>
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto grid max-w-editorial gap-12 px-6 py-16 md:py-20 lg:grid-cols-[minmax(15rem,0.34fr)_minmax(0,0.66fr)]">
          <aside>
            <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.2em] text-forest/55">A few useful places</p>
            <nav className="mt-5 space-y-3 font-body text-sm text-forest/75">
              <p><Link href="/pricing" className="underline decoration-gold underline-offset-4">Pricing &amp; what each plan includes</Link></p>
              <p><Link href="/terms" className="underline decoration-gold underline-offset-4">Refunds, cancellations &amp; Terms</Link></p>
              <p><Link href="/delete-account" className="underline decoration-gold underline-offset-4">Delete your account</Link></p>
              <p><Link href="/privacy" className="underline decoration-gold underline-offset-4">Privacy Policy</Link></p>
            </nav>
          </aside>

          <div>
            <QuestionGroup eyebrow="Planning" title="Getting your gathering into one place" questions={planningQuestions} />
            <QuestionGroup eyebrow="Your people" title="Invites, RSVPs and helping hands" questions={peopleQuestions} />
            <QuestionGroup eyebrow="Purchases" title="Plans, billing and refunds" questions={billingQuestions} />

            <section className="border-t border-sage/25 pt-10">
              <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.2em] text-forest/55">Still stuck?</p>
              <h2 className="mt-2 font-display text-2xl text-forest">Tell us what happened.</h2>
              <p className="mt-3 max-w-2xl font-body text-base leading-relaxed text-forest/72">
                Screenshots are helpful. So is the name of the gathering you were in and whether you were using the website, iPhone, or Android. We do not need your password, card number, or private store credentials.
              </p>
              <a href="mailto:support@placeandplenty.com" className="mt-5 inline-flex border-b border-gold pb-1 font-body text-sm font-bold uppercase tracking-[0.12em] text-forest">
                Email support
              </a>
            </section>
          </div>
        </div>
      </Band>
    </>
  );
}
