import { canvaConfig } from "@/lib/canva-server";
import { validateOAuthRequest } from "@/lib/canva-security";
import { getUser } from "@/lib/supabase-server";
import { authorizeCanva } from "./actions";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Connect Canva | Place & Plenty",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Authorize({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams))
    if (typeof value === "string") params.set(key, value);
  try {
    validateOAuthRequest(params, canvaConfig());
  } catch {
    return (
      <main>
        <h1>Canva connection unavailable</h1>
        <p>Return to Canva and start a new connection.</p>
      </main>
    );
  }
  const user = await getUser();
  const action = authorizeCanva.bind(null, params.toString());
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1>Connect Canva to Place &amp; Plenty</h1>
      <p>
        Signed in as {user?.email}. Canva can list gatherings you have access to
        and save invitation artwork when you choose to publish.
      </p>
      <p>
        Your current plan and gathering permissions still apply. This connection
        expires within ten minutes.
      </p>
      {searchParams.retry_after && (
        <p role="alert">
          Too many connection attempts. Wait{" "}
          {Math.max(1, Math.min(600, Number(searchParams.retry_after) || 60))}{" "}
          seconds before trying again.
        </p>
      )}
      <form action={action}>
        <button type="submit">Allow connection</button>
      </form>
      <a href="/host">Cancel and return to My Gatherings</a>
    </main>
  );
}
