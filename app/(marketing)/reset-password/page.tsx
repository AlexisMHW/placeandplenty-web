import type { Metadata } from "next";
import Eyebrow from "@/components/Eyebrow";
import ResetPasswordForm from "./ResetPasswordForm";
import { getUser } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Set a new password",
  alternates: { canonical: "/reset-password" },
  robots: { index: false, follow: false },
};

// /reset-password — where a recovery link lands after /auth/callback has
// exchanged its code for a session.
//
// THE SESSION IS THE AUTHORISATION. There is no token in this URL and
// there must not be: by the time someone gets here the recovery code has
// already been exchanged, so the proof they may set a new password is
// that they hold a valid session. Checking it on the SERVER means a
// visitor with no session sees the "request a new link" state rather
// than a password form that would fail on submit.
//
// This route is deliberately not behind the /host gate in middleware.
// Someone resetting a password is mid-recovery, and bouncing them to
// /login — to enter the password they have forgotten — would be a loop.

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const user = await getUser();
  const linkFailed = Boolean(searchParams.error);

  return (
    <section className="bg-parchment py-16 md:py-24">
      <div className="mx-auto grid max-w-editorial gap-10 px-6 md:grid-cols-2 md:items-center md:gap-14">
        <div>
          <Eyebrow>Your account</Eyebrow>
          <h1 className="mt-4 font-display text-4xl leading-tight text-forest md:text-5xl">
            {user && !linkFailed
              ? "Set a new password."
              : "That link has expired."}
          </h1>
          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            {user && !linkFailed
              ? "Pick something you'll remember. This is the same password you'll use in the app."
              : "Reset links work once and don't last long. Ask for a fresh one and we'll send it straight over."}
          </p>
        </div>

        <ResetPasswordForm canReset={Boolean(user) && !linkFailed} />
      </div>
    </section>
  );
}
