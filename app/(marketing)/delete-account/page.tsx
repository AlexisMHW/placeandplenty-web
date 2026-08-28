// DELETE ACCOUNT — corrected 27 Aug 2026.
//
// The previous copy said in-app deletion was "planned for a future
// release" and that requests were handled manually. That stopped being
// true when in-app deletion shipped, and telling a user their only route
// is email when a self-serve button exists is worse than saying nothing.
//
// This page must keep BOTH routes. Google requires account deletion to
// be requestable without reinstalling the app, so the email route stays
// even though the in-app one now exists. Do not "tidy" it away.
//
// The deleted/retained lists below are the verified behaviour of the
// delete-account Edge Function and delete_user_account_data(), not an
// approximation. They must agree with /privacy. If deletion behaviour
// changes, change all three together.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "/delete-account" },
  openGraph: { url: "/delete-account" },
  title: "Delete Account",
  description:
    "How to delete your Place & Plenty account and data — in the app, or by email if you no longer have it installed.",
};

const steps = [
  {
    step: "1",
    title: "In the app",
    body: (
      <>
        Open Place &amp; Plenty and go to{" "}
        <strong className="font-semibold text-forest">
          Settings &rarr; Delete my account
        </strong>
        . You will be asked to confirm. Deletion happens straight away.
      </>
    ),
  },
  {
    step: "2",
    title: "Or by email, if you no longer have the app",
    body: (
      <>
        Email{" "}
        <a
          href="mailto:support@placeandplenty.com?subject=Account%20Deletion%20Request"
          className="underline decoration-gold underline-offset-4"
        >
          support@placeandplenty.com
        </a>{" "}
        from the address on your account, with the subject{" "}
        <span className="italic">Account Deletion Request</span>. Tell us
        which email or Apple/Google sign-in you used so we can find the
        account. We will confirm once it is done.
      </>
    ),
  },
];

export default function DeleteAccountPage() {
  return (
    <section className="bg-offwhite py-16 md:py-24">
      <div className="mx-auto max-w-prose px-6">
        <p className="mb-3 font-body text-xs font-bold uppercase tracking-[0.2em] text-goldInk">
          Your account, your call
        </p>
        <h1 className="font-display text-4xl leading-tight text-forest md:text-5xl">
          Delete your account
        </h1>
        <p className="mt-6 font-body text-lg leading-relaxed text-forest/80">
          You can delete your Place &amp; Plenty account and its data
          yourself, at any time. There are two ways to do it.
        </p>

        <ol className="mt-10 space-y-5">
          {steps.map((s) => (
            <li
              key={s.step}
              className="rounded-card border border-sage/30 bg-cream p-6 shadow-softer"
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-forest font-display text-lg text-offwhite"
                >
                  {s.step}
                </span>
                <div>
                  <h2 className="font-display text-xl text-forest">
                    {s.title}
                  </h2>
                  <p className="mt-2 font-body text-sm leading-relaxed text-forest/80">
                    {s.body}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-14 font-display text-2xl text-forest">
          What gets deleted
        </h2>
        <ul className="mt-4 space-y-2 pl-5 font-body leading-relaxed text-forest/80 [&>li]:list-disc [&>li]:marker:text-goldInk">
          <li>Your account and profile.</li>
          <li>The gatherings you own.</li>
          <li>Your guest records and My Guest Book.</li>
          <li>
            Your menus, shopping lists, tasks, contributions, expenses and
            receipts.
          </li>
          <li>My Hosting Closet.</li>
          <li>
            <strong className="font-semibold text-forest">
              The AI analyses of the inside of your home
            </strong>{" "}
            created by Space Mode.
          </li>
          <li>
            Every file you uploaded, across all six storage areas — invitation
            artwork, style images, room photos, closet photos, receipts and
            gathering photos.
          </li>
        </ul>

        <h2 className="mt-12 font-display text-2xl text-forest">
          What we keep, and why
        </h2>
        <p className="mt-4 font-body leading-relaxed text-forest/80">
          One record per purchase, with nothing in it that points back to
          you: the store transaction identifiers, the product, the
          entitlement type and scope, the store environment, and the
          purchase, expiry, refund and revocation dates.
        </p>
        <p className="mt-4 font-body leading-relaxed text-forest/80">
          These records contain{" "}
          <strong className="font-semibold text-forest">
            no user id, no gathering id and no email address
          </strong>
          . We keep them only because refunds, tax, accounting and fraud
          obligations require a record that a purchase happened.
        </p>

        <div className="mt-10 rounded-card border border-error/40 bg-error/5 p-6">
          <p className="font-body text-sm font-bold uppercase tracking-wide text-error">
            Before you delete
          </p>
          <p className="mt-2 font-body text-sm leading-relaxed text-forest/80">
            Deletion is permanent and cannot be undone. If you own a
            gathering you share with a co-host, deleting your account deletes
            that gathering too — along with your co-host&rsquo;s access and
            everything they contributed to it. There is no way to transfer a
            gathering to someone else in this version, so if a co-host needs
            to keep it, talk to them first.
          </p>
        </div>

        <p className="mt-10 font-body text-sm leading-relaxed text-forest/70">
          For the full picture of what we hold and why, see our{" "}
          <Link
            href="/privacy"
            className="underline decoration-gold underline-offset-4"
          >
            Privacy Policy
          </Link>
          . For anything else,{" "}
          <Link
            href="/support"
            className="underline decoration-gold underline-offset-4"
          >
            we&rsquo;re here
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
