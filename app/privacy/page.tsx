// PRIVACY POLICY — drafted 27 Aug 2026 from verified V1 behaviour.
//
// STATUS: PENDING LEGAL REVIEW. Every factual claim below was checked
// against the live Supabase project (iyvdxvotthwrerirdzwd), the deployed
// Edge Function sources, and the app's Current State audit. It has NOT
// been reviewed by an attorney. Nothing on the page claims that it has.
//
// Items counsel must settle before this is final — each marked in the
// copy with the words "under review":
//   * the legal entity name and mailing address
//   * whether a US state-specific rights section (CA/CO/CT/VA) is needed
//   * whether any EU/UK transfer language is needed for the launch market
//
// If app behaviour changes, this page changes with it. Specifically: it
// currently states there is NO analytics, advertising, attribution or
// crash-reporting SDK on either surface. That is true today (directive
// §22). Adding one makes this page false.

import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalCallout } from "@/components/LegalPage";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  openGraph: { url: "/privacy" },
  title: "Privacy Policy",
  description:
    "What Place & Plenty collects, why, who it is shared with, how long it is kept, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="27 August 2026"
      intro={
        <p>
          Place &amp; Plenty helps you get ready for people coming over. To
          do that it holds some genuinely personal things — who you are
          having over, what they can and cannot eat, sometimes photographs
          of the inside of your home. This page explains what we keep, why,
          who else sees it, and how to make it go away.
        </p>
      }
    >
      <LegalCallout heading="The short version">
        <ul>
          <li>
            We do not sell your personal information, and we do not share it
            for advertising.
          </li>
          <li>
            There is no analytics SDK, advertising SDK, attribution SDK or
            crash-reporting SDK in the Place &amp; Plenty app.
          </li>
          <li>
            You can delete your account and its data yourself, from inside
            the app, at any time.
          </li>
          <li>
            Guest contact details belong to the host who entered them. We
            use them to run that gathering, not to market to your guests.
          </li>
        </ul>
      </LegalCallout>

      <h2>Who we are</h2>
      <p>
        Place &amp; Plenty (&ldquo;Place &amp; Plenty&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;) provides the Place &amp; Plenty
        mobile app and this website. You can reach us at{" "}
        <a href="mailto:support@placeandplenty.com">
          support@placeandplenty.com
        </a>
        . Our legal entity name and mailing address are under review and
        will be published here.
      </p>

      <h2>What we collect</h2>

      <h3>Your account</h3>
      <p>
        Your email address, and a display name if you give one. If you sign
        in with Apple or Google, we receive the identifier and email address
        those services return — we never receive your password.
      </p>

      <h3>What you tell us about your gathering</h3>
      <p>
        The things you enter to plan with: the gathering name, date, arrival
        time, timezone, the location name you type, guest counts, your
        budget target, food style, whether it is indoors or outdoors, your
        notes, menus, recipes, shopping lists, tasks, and what you own in My
        Hosting Closet.
      </p>

      <h3>Information about your guests</h3>
      <p>
        When you invite people, you give us information about them: names,
        and contact details where you provide them. Guests may also add
        their own dietary, allergy and accessibility notes when they respond
        to your invitation. That information is entered for one gathering
        and is kept separate from your reusable My Guest Book records, so a
        guest correcting an allergy for one dinner does not silently rewrite
        your My Guest Book entry for them.
      </p>
      <p>
        <strong>
          If you are a guest and want to know what a host holds about you, or
          want it removed, write to us
        </strong>{" "}
        at{" "}
        <a href="mailto:support@placeandplenty.com">
          support@placeandplenty.com
        </a>{" "}
        and we will help. Because the host entered it, we will usually need
        to involve them.
      </p>

      <h3>Photographs and files</h3>
      <p>
        Depending on which features you use: invitation artwork, inspiration
        and style images, photographs of your rooms for Space Mode,
        photographs of items in your Hosting Closet, receipts you attach to
        expenses, and gathering photos. All six storage areas are private —
        none is publicly readable, and files are served through short-lived
        signed links.
      </p>

      <h3>Purchases</h3>
      <p>
        If you buy a Gathering Pass or Place &amp; Plenty Plus, the payment
        itself is handled entirely by Apple or Google. We never see your card
        details. We record what you are entitled to, the store transaction
        identifiers, the product, and the relevant dates.
      </p>

      <h3>Notifications</h3>
      <p>
        If you turn on notifications, we store a push token for your device
        so we can send them, along with the platform and whether the device
        is still active.
      </p>

      <h3>What we do not collect</h3>
      <p>
        We do not collect your precise device location. We do not use
        cookies or similar technologies for advertising or cross-site
        tracking. We do not build advertising profiles. We do not run
        session replay.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>To run the features you asked for.</li>
        <li>To keep one accurate, shared record across the app and the web, so a guest&rsquo;s RSVP on their phone is the same RSVP you see in My People.</li>
        <li>To send you notifications and reminders you have enabled.</li>
        <li>To provide support when you write to us.</li>
        <li>To honour purchases, and to meet refund, tax and fraud obligations.</li>
        <li>To keep the service secure and working.</li>
      </ul>

      <h2>Who else processes it</h2>
      <p>
        We use a small number of service providers. They process data on our
        instructions, for the purposes below, and for nothing else.
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — our database, authentication, file
          storage and server functions. Hosted in the United States. This is
          where your account and gathering data lives.
        </li>
        <li>
          <strong>Anthropic</strong> — the AI behind planning features such
          as Figure It Out For Me, recipe and styling suggestions, and Space
          Mode. Relevant gathering details are sent for the feature you
          invoked. <strong>For Space Mode this includes the photograph of
          your room.</strong>
        </li>
        <li>
          <strong>OpenStreetMap (Nominatim) and the US National Weather
          Service</strong> — for the weather outlook. Only the{" "}
          <strong>city name</strong> you entered is sent for geocoding; we do
          not send your street address.
        </li>
        <li>
          <strong>Expo push notification service</strong> — delivers
          notifications to your device, passing them on to Apple or Google.
          It receives the push token and the notification text.
        </li>
        <li>
          <strong>Apple and Google</strong> — process purchases and
          subscriptions under their own terms and privacy policies.
        </li>
        <li>
          <strong>Vercel</strong> — hosts this website and keeps standard
          server request logs.
        </li>
      </ul>
      <p>
        We do not sell personal information, and we do not share it for
        cross-context behavioural advertising.
      </p>

      <h2>Guest links and what they reveal</h2>
      <p>
        Invitation and gallery links contain a token. Anyone holding the link
        can open the page it belongs to, so treat them like an invitation you
        would not want forwarded to strangers.
      </p>
      <p>
        Guest pages are deliberately restrictive. Every option is off until a
        host turns it on — <strong>including your address</strong>. A guest
        link is never, by itself, permission to show where you live. Guest
        pages never expose your budget, your Hosting Closet, your private
        notes, planning internals, or other guests&rsquo; contact details.
        The photo gallery uses a separate link from the invitation, so a
        gallery can be shared or revoked without breaking anyone&rsquo;s
        RSVP.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          <strong>Account and gathering data</strong> — until you delete your
          account, or ask us to.
        </li>
        <li>
          <strong>Gathering photos</strong> — these expire. An expiry is set
          when the photo is uploaded and expired photos are purged
          automatically. Indefinite storage of your guests&rsquo; photographs
          is not a reasonable default.
        </li>
        <li>
          <strong>Support email</strong> — kept as long as needed to deal
          with your request and any follow-up.
        </li>
      </ul>

      <h2>Deleting your account</h2>
      <p>
        You can delete your account yourself, in the app, under{" "}
        <strong>Settings &rarr; Delete my account</strong>. If you no longer
        have the app installed, you can request deletion by email — see{" "}
        <Link href="/delete-account">Delete Account</Link>.
      </p>

      <LegalCallout heading="What deletion actually does">
        <p>
          <strong>Deleted:</strong> your account and profile; the gatherings
          you own; your guest and address-book records; your menus, shopping
          lists, tasks, contributions and expenses; your Hosting Closet;{" "}
          <strong>the AI analyses of the inside of your home</strong>; and
          your uploaded files across all six storage areas.
        </p>
        <p>
          <strong>Retained, with no way to link it back to you:</strong> one
          record per purchase — the store transaction identifiers, the
          product, the entitlement type and scope, the store environment, and
          the purchase, expiry, refund and revocation dates. These records
          contain <strong>no user id, no gathering id and no email
          address</strong>. We keep them only for refund, tax, accounting and
          fraud obligations.
        </p>
        <p>
          <strong>Please note:</strong> if you own gatherings that you share
          with a co-host, deleting your account deletes those gatherings and
          everything your co-host contributed to them. There is no way to
          transfer ownership in this version.
        </p>
      </LegalCallout>

      <h2>Your choices and rights</h2>
      <p>
        You can view and correct most of your information directly in the
        app. You can turn notifications off on your device or in the app. You
        can delete your account as described above. Depending on where you
        live you may also have rights to access, correct, delete or obtain a
        copy of your personal information, and to complain to a regulator.
        Write to{" "}
        <a href="mailto:support@placeandplenty.com">
          support@placeandplenty.com
        </a>{" "}
        and we will help. We will not treat you differently for exercising a
        right. Any additional region-specific disclosures are under review
        and will be added here.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit. Every table in our database has
        row-level security enabled, and all six file storage areas are
        private rather than public. Guest actions are resolved server-side
        from the guest&rsquo;s token, so a guest link cannot be used to read
        anything beyond that guest&rsquo;s own view of the gathering. No
        system is perfectly secure, and we do not claim otherwise.
      </p>

      <h2>Children</h2>
      <p>
        Place &amp; Plenty is not directed to children under 13, and we do
        not knowingly collect personal information from them. Hosts do
        sometimes record children as guests — a name, and dietary or allergy
        notes — as part of planning a family gathering. That information is
        provided by the host, is used only to run that gathering, and is
        deleted with it. If you believe a child&rsquo;s information is held
        in a way you did not intend, write to us and we will remove it.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy we will update the date at the top, and for
        anything significant we will say so in the app. This page is intended
        to describe what the product actually does; if the two ever disagree,
        tell us and we will fix the page.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:support@placeandplenty.com">
          support@placeandplenty.com
        </a>
      </p>
    </LegalPage>
  );
}
