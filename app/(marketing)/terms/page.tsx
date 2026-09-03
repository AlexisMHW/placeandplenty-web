// TERMS OF USE — pricing, entitlement and refund language must stay aligned
// with lib/pricing.ts, lib/entitlements.ts and lib/refund-policy.ts.
// STATUS: PENDING LEGAL REVIEW for entity/address, governing law/venue,
// arbitration/class-waiver choice and limitation-of-liability enforceability.

import type { Metadata } from "next";
import Link from "next/link";
import { PRICING_TIERS } from "@/lib/pricing";
import { REFUND_POLICY } from "@/lib/refund-policy";
import LegalPage, { LegalCallout } from "@/components/LegalPage";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  openGraph: { url: "/terms" },
  title: "Terms of Use",
  description:
    "The terms you agree to when you use Place & Plenty, including pricing, purchases, cancellations, refunds, acceptable use, and the limits of what the app promises.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      lastUpdated="2 September 2026"
      intro={
        <p>
          These terms cover the Place &amp; Plenty app and this website. They
          are written to be read. By creating an account or using Place &amp;
          Plenty, you agree to them.
        </p>
      }
    >
      <h2>Who can use Place &amp; Plenty</h2>
      <p>
        You need to be at least 13. If you are under 18, you need a parent or
        guardian&rsquo;s permission, and they need to agree to these terms too.
        You are responsible for what happens under your account, so keep your
        sign-in details to yourself.
      </p>

      <h2>What Place &amp; Plenty is</h2>
      <p>
        A tool for planning home gatherings — everything between
        &ldquo;people are coming&rdquo; and the doorbell ringing. It helps you
        organise. It does not cook, clean, shop, or guarantee that your
        gathering goes well.
      </p>

      <h2>Your content</h2>
      <p>
        What you put into Place &amp; Plenty stays yours. You give us
        permission to store, process and display it for the purpose of running
        the service for you — including showing the parts you have chosen to
        share on a guest page. That permission ends when you delete the
        content or your account, except where we are required to keep
        something (see the <Link href="/privacy">Privacy Policy</Link>).
      </p>
      <p>
        You are responsible for what you upload, and you confirm you have the
        right to upload it.
      </p>

      <h2>Information about other people</h2>
      <p>
        When you add guests, you are giving us other people&rsquo;s information.
        You confirm you have a proper basis for doing so, and that you will use
        Place &amp; Plenty to invite people to real gatherings rather than to
        send unwanted messages. Do not use guest features for marketing, bulk
        messaging, or anything a reasonable person would call spam.
      </p>
      <p>
        Invitation and gallery links contain a token. Anyone who has the link
        can open the page, so share them the way you would share an invitation.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not break the law, or use Place &amp; Plenty to harm, harass or impersonate anyone.</li>
        <li>Do not upload anything you do not have the right to upload.</li>
        <li>Do not upload photographs of other people, or of the inside of someone else&rsquo;s home, without their agreement.</li>
        <li>Do not try to reach other people&rsquo;s accounts, gatherings or data, or probe, scrape or overload the service.</li>
        <li>Do not resell or redistribute the service.</li>
      </ul>

      <h2>Pricing and purchases</h2>

      <LegalCallout heading="What things cost">
        <ul>
          {PRICING_TIERS.map((tier) => (
            <li key={tier.name}>
              <strong>{tier.name} — {tier.priceLine}</strong>{" "}
              {tier.description}
            </li>
          ))}
        </ul>
      </LegalCallout>

      <p>
        Place &amp; Plenty Plus is an annual subscription. Within a subscription
        term it covers:
      </p>
      <ul>
        <li>up to <strong>6 open gatherings</strong> at one time, including drafts;</li>
        <li>up to <strong>12 locked-in gatherings</strong> per annual term;</li>
        <li>drafts do not use the 12-gathering annual allowance until they are finished and locked in;</li>
        <li>after 12 locked-in gatherings in a term, further gatherings can be unlocked with a Gathering Pass;</li>
        <li>account-level Plus features stay available throughout the paid term.</li>
      </ul>
      <p>
        These are real limits, and we state them plainly rather than implying
        there are none.
      </p>

      <h3>One account, several ways to buy</h3>
      <p>
        You can buy a Gathering Pass or Place &amp; Plenty Plus on
        placeandplenty.com, through the Apple App Store, or through Google
        Play. Whichever you choose, what you buy is attached to your Place
        &amp; Plenty account rather than to a device, browser or store, so an
        entitlement bought on the web is available in the app and one bought
        through a store is available on the web. There are no separate web and
        app plans, and buying on one platform does not require buying again on
        another.
      </p>

      <h3>Feature availability across platforms</h3>
      <p>
        <strong>
          Some Plus features require the Place &amp; Plenty mobile app. Plus
          access follows your account across platforms, but feature
          availability may vary between web and mobile.
        </strong>{" "}
        In particular, Host Mode and Space Mode are available only in the
        mobile app because they depend on mobile-device capabilities.
      </p>
      <p>
        Your purchase gives you access to your plan on your account. It is not
        a promise that every feature is available on every platform. Subject
        to applicable law, we are not responsible for your inability to use a
        feature that requires the mobile app where that inability results
        solely from your choice not to install or use the app on a compatible
        device.
      </p>

      <h3>How you are billed</h3>
      <p>
        Purchases made on placeandplenty.com are billed through our web
        payment provider and are managed from your Place &amp; Plenty account.
        Purchases made through the Apple App Store or Google Play are billed by
        that store, governed by that store&rsquo;s terms as well as these, and
        are managed and cancelled in that store. We do not receive your full
        card details. Plus renews annually unless renewal is turned off before
        the term ends.
      </p>

      <h3>Cancellation</h3>
      <p>{REFUND_POLICY.plus.full}</p>
      <p>
        Deleting your Place &amp; Plenty account does not by itself cancel a
        subscription billed by Apple or Google. If you bought Plus through a
        store, cancel renewal in that store. If you bought Plus directly on
        placeandplenty.com, manage it through your Place &amp; Plenty account.
      </p>

      <h3>Gathering Pass refunds and transfers</h3>
      <p>{REFUND_POLICY.gatheringPass.full}</p>

      <h3>Plus refund requests</h3>
      <p>{REFUND_POLICY.initialPlusRefund}</p>
      <p>{REFUND_POLICY.renewals}</p>

      <h3>Where refunds are handled</h3>
      <p>{REFUND_POLICY.stores}</p>
      <p>{REFUND_POLICY.web}</p>
      <p>{REFUND_POLICY.errors}</p>
      <p>{REFUND_POLICY.law}</p>

      <h2>AI features — please read this one</h2>
      <p>
        Several features use AI to make suggestions: preparation plans,
        recipes and quantities, styling ideas, soundtracks, and Space
        Mode&rsquo;s analysis of a room. Suggestions are suggestions. They can
        be wrong.
      </p>
      <p>
        <strong>You are responsible for food safety, allergies and dietary requirements.</strong>{" "}
        Do not rely on Place &amp; Plenty to keep a guest safe. Check
        ingredients and allergens yourself, and confirm anything that matters
        directly with the person it affects.
      </p>
      <p>
        The weather outlook is drawn from the US National Weather Service and
        is provided for convenience. It is a forecast, not a promise, and it
        is only available where that service has coverage.
      </p>

      <h2>Availability</h2>
      <p>
        Place &amp; Plenty changes over time. Features may be added, altered or
        withdrawn, and parts of the service may be unavailable from time to
        time — for maintenance, or because something outside our control has
        gone wrong. We will try not to surprise you by removing something you
        depend on.
      </p>

      <h2>Ending things</h2>
      <p>
        You can stop using Place &amp; Plenty at any time and delete your
        account from <strong>Settings &rarr; Delete my account</strong>, or by
        following <Link href="/delete-account">these instructions</Link>.
        Deleting your account deletes the gatherings you own, including access
        and contributions belonging to any co-host, and it cannot be undone.
      </p>
      <p>
        We may suspend or close an account that breaks these terms or puts
        other people at risk. Where it is reasonable to do so, we will tell
        you why first.
      </p>

      <h2>What we do not promise</h2>
      <p>
        Place &amp; Plenty is provided &ldquo;as is&rdquo;. To the fullest extent
        the law allows, we do not make warranties that the service will be
        uninterrupted, error-free, or that its suggestions will suit your
        particular gathering.
      </p>
      <p>
        To the fullest extent the law allows, we are not liable for indirect
        or consequential losses, and our total liability to you is limited to
        the amount you paid us in the twelve months before the claim. Nothing
        here limits liability that cannot be limited by law.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        If we change these terms we will update the date at the top, and for
        anything significant we will tell you in the app. Continuing to use
        Place &amp; Plenty after a change means you accept it.
      </p>

      <h2>Governing law</h2>
      <p>
        The governing law and venue for disputes will be stated here before
        Place &amp; Plenty is offered for sale. Nothing in these terms waives
        any right you have under the law that applies where you live.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:support@placeandplenty.com">support@placeandplenty.com</a>
      </p>
    </LegalPage>
  );
}
