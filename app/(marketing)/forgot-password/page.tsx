import type { Metadata } from "next";
import Eyebrow from "@/components/Eyebrow";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset the password for your Place & Plenty account.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return (
    <section className="bg-parchment py-16 md:py-24">
      <div className="mx-auto grid max-w-editorial gap-10 px-6 md:grid-cols-2 md:items-center md:gap-14">
        <div>
          <Eyebrow>Your account</Eyebrow>
          <h1 className="mt-4 font-display text-4xl leading-tight text-forest md:text-5xl">
            Let&rsquo;s get you back in.
          </h1>
          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            Tell us the email you use for Place &amp; Plenty and we&rsquo;ll
            send a link to set a new password. It works for the app and the
            website — it&rsquo;s the same account.
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </section>
  );
}
