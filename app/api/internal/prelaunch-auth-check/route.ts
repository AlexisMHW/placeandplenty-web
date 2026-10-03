import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_PROVIDER_HOST: Record<"google" | "apple", string> = {
  google: "accounts.google.com",
  apple: "appleid.apple.com",
};

async function checkProvider(
  base: string,
  anonKey: string,
  provider: "google" | "apple"
) {
  const redirectTo =
    "https://placeandplenty.com/auth/callback?next=%2Fhost";
  const endpoint =
    base +
    "/auth/v1/authorize?provider=" +
    provider +
    "&redirect_to=" +
    encodeURIComponent(redirectTo);

  const response = await fetch(endpoint, {
    method: "GET",
    redirect: "manual",
    headers: { apikey: anonKey },
    cache: "no-store",
  });

  const location = response.headers.get("location");
  let locationHost: string | null = null;
  if (location) {
    try {
      locationHost = new URL(location).hostname;
    } catch {
      locationHost = null;
    }
  }

  return {
    status: response.status,
    redirectsToExpectedProvider: locationHost === EXPECTED_PROVIDER_HOST[provider],
    locationHost,
  };
}

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!base || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "missing_web_supabase_environment" },
      { status: 500 }
    );
  }

  const settingsResponse = await fetch(base + "/auth/v1/settings", {
    headers: { apikey: anonKey },
    cache: "no-store",
  });

  const settings = (await settingsResponse.json().catch(() => ({}))) as {
    external?: Record<string, boolean>;
  };

  const [google, apple] = await Promise.all([
    checkProvider(base, anonKey, "google"),
    checkProvider(base, anonKey, "apple"),
  ]);

  return NextResponse.json({
    ok: settingsResponse.ok,
    providers: {
      googleEnabled: settings.external?.google === true,
      appleEnabled: settings.external?.apple === true,
    },
    oauthStart: { google, apple },
    testedRedirect:
      "https://placeandplenty.com/auth/callback?next=%2Fhost",
  });
}
