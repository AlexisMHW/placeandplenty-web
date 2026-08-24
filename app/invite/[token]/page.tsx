import type { Metadata } from "next";
import GuestPageClient from "./GuestPageClient";

// This route must never be indexed — it's reached only via a
// bearer-token link sent in an invitation email.
export const metadata: Metadata = {
  title: "You're Invited",
  robots: { index: false, follow: false },
};

export default function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  return <GuestPageClient token={params.token} />;
}
