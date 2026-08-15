import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete Account",
  description: "How to request deletion of your Place & Plenty account.",
};

export default function DeleteAccountPage() {
  return (
    <section className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto max-w-prose px-6">
        <h1 className="font-display text-4xl text-forest">Delete Account</h1>
        <p className="mt-6 font-body text-lg leading-relaxed text-forest/80">
          To request deletion of your Place &amp; Plenty account and
          associated data, email{" "}
          <a
            href="mailto:support@placeandplenty.com?subject=Account%20Deletion%20Request"
            className="underline decoration-gold underline-offset-4"
          >
            support@placeandplenty.com
          </a>{" "}
          from the email address associated with your account, with the
          subject line &ldquo;Account Deletion Request.&rdquo;
        </p>
        <p className="mt-4 font-body text-base leading-relaxed text-forest/70">
          Please include the email address or Apple/Google sign-in you used
          to create your account so we can locate it. We&rsquo;ll confirm
          once your request has been processed.
        </p>
        <div className="mt-8 rounded-card border border-gold bg-cream p-6 font-body text-sm text-forest/80">
          <p className="font-semibold">Note</p>
          <p className="mt-2">
            In-app self-serve account deletion is planned for a future
            release. Until then, deletion requests are handled manually via
            the email above.
          </p>
        </div>
      </div>
    </section>
  );
}
