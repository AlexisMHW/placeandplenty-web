import type { Metadata } from "next";
import CompleteClient from "./CompleteClient";

// Finishes an email link whose credentials arrived in the URL fragment (links requested from the app). See lib/auth-redirects.ts.
export const metadata: Metadata = { title: "Finishing sign-in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AuthCompletePage({ searchParams }: { searchParams: { next?: string; recovery?: string } }) {
  return <CompleteClient next={searchParams.next} recovery={searchParams.recovery === "1"} />;
}
