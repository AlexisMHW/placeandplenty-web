import type { Metadata } from "next";
import Link from "next/link";

// Where an email-confirmation link from the APP lands once the email is confirmed. The confirmation already happened (and the
// callback signed the browser in); this page says so plainly and points back to the app.
export const metadata: Metadata = { title: "Email confirmed", robots: { index: false, follow: false } };

export default function EmailConfirmedPage() {
  return (
    <main className="mx-auto max-w-prose px-6 py-24 text-center">
      <h1 className="font-display text-3xl text-forest md:text-4xl">Your email is confirmed.</h1>
      <p className="mt-4 font-body text-lg text-forest/80">
        Go back to the Place &amp; Plenty app and sign in with the same email and password. If you started on this device, you can also
        carry on here on the website.
      </p>
      <p className="mt-8">
        <Link href="/host" className="rounded-full bg-forest px-6 py-3 font-body font-semibold text-offwhite">
          Continue on the website
        </Link>
      </p>
    </main>
  );
}
