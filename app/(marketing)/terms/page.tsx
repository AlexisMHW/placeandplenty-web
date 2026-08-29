// TERMS OF USE — drafted 27 Aug 2026 from verified V1 behaviour.
//
// STATUS: PENDING LEGAL REVIEW. Pricing and entitlement terms match the
// approved V1 model (directive §20) and lib/pricing.ts. Nothing on the
// page claims it has been reviewed by an attorney.
//
// Items counsel must settle before this is final — each marked in the
// copy with the words "under review":
//   * legal entity name and mailing address
//   * governing law and venue
//   * whether an arbitration / class-action-waiver clause is wanted
//   * whether the limitation-of-liability cap is enforceable as drafted
//
// DO NOT let this page drift from lib/pricing.ts or the store listings.
// Never write "unlimited". There is no monthly Plus at V1.

import type { Metadata } from "next";
import { PRICING_TIERS } from "@/lib/pricing";
import Link from "next/link";
import LegalPage, { LegalCallout } from "@/components/LegalPage";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  openGraph: { url: "/terms" },
  title: "Terms of Use",
  description:
    "The terms you agree to when you use Place & Plenty, including pricing, purchases, acceptable use, and the limits of what the app promises.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      lastUpdated="27 August 2026"
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
        guardian&rsquo;s permission, and they need to agree to these terms
        too. You are responsible for what happens under your account, so keep
        your sign-in details to yourself.
      </p>

      <h2>What Place &amp; Plenty is</h2>
      <p>
        A tool for planning home gatherings — everything between
        &ldquo;people are coming&rdquo; and the doorbell ringing. It helps
        you organise. It does not cook, clean, shop, or guarantee that your
        gathering goes well.
      </p>

      <h2>Your content</h2>
      <p>
        What you put into Place &amp; Plenty stays yours. You give us
        permission to store, process and display it for the purpose of
        running the service for you — including showing the parts you have
        chosen to share on a guest page. That permission ends when you delete
        the content or your account, except where we are required to keep
        something (see the{" "}
        <Link href="/privacy">Privacy Policy</Link>).
      </p>
      <p>
        You are responsible for what you upload, and you confirm you have the
        right to upload it.
      </p>

      <h2>Information about other people</h2>
      <p>
        When you add guests, you are giving us other people&rsquo;s
        information. You confirm you have a proper basis for doing so, and
        that you will use Place &amp; Plenty to invite people to real
        gatherings rather than to send unwanted messages. Do not use guest
        features for marketing, bulk messaging, or anything a reasonable
        person would call spam.
      </p>
      <p>
        Invitation and gallery links contain a token. Anyone who has the link
        can open the page, so share them the way you would share an
        invitation.
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
        {/* Rendered from lib/pricing.ts, never typed here. The
            "+ applicable taxes and fees" qualifier is part of the value,
            so this page cannot quietly disagree with /pricing. It said
            "plus applicable tax" until 28 Aug 2026 — the exact wording
            that is ruled out — and it survived a text sweep because the
            phrase was split across a line break. */}
        <ul>
          {PRICING_TIERS.map((tier) => (
            <li key={tier.name}>
              <strong>
                {tier.name} — {tier.priceLine}
              </strong>{" "}
              {tier.description}
            </li>
          ))}
        </ul>
      </LegalCallout>

      <p>
        Place &amp; Plenty Plus is an annual subscription. Within a
        subscription term it covers:
      </p>
      <ul>
        <li>up to <strong>6 active gatherings</strong> at one time;</li>
        <li>up to <strong>12 locked-in gatherings</strong> per annual term;</li>
        <li>drafts do not count toward either limit;</li>
        <li>
          after 12 locked-in gatherings in a term, further gatherings can be
          unlocked with a Gathering Pass;
        </li>
        <li>account-level Plus features stay available throughout.</li>
      </ul>
      <p>
        These are real limits, and we state them plainly rather than
        implying there are none.
      </p>

      <h3>One account, several ways to buy</h3>
      <p>
        You can buy a Gathering Pass or Place &amp; Plenty Plus on
        placeandplenty.com, through the Apple App Store, or through Google
        Play. Whichever you choose, what you buy is attached to your Place
        &amp; Plenty account rather than to a device, a browser or a store, so
        an entitlement bought on the web is available in the app and one
        bought through a store is available on the web. There are no separate
        web and app plans, and buying on one platform does not require buying
        again on another.
      </p>

      <h3>Feature availability across platforms</h3>
      <p>
        <strong>
          Some Plus features require the Place &amp; Plenty mobile app. Plus
          access follows your account across platforms, but feature
          availability may vary between web and mobile.
        </strong>{" "}
        In particular, Host Mode and Space Mode are available only in the
        mobile app, because they depend on mobile-device capabilities:
        gathering-day push notifications in the first case and the device
        camera in the second. Other features may also be limited to a
        particular platform where they depend on that platform&rsquo;s
        capabilities, and the set of such features may change over time.
      </p>
      <p>
        Your purchase gives you access to your plan on your account. It is not
        a promise that every feature is available on every platform. Subject
        to applicable law, we are not responsible for your inability to use a
        feature that requires the mobile app where that inability results
        solely from your choice not to install or use the app on a compatible
        device. If a feature you expected is not available on the platform you
        are using, write to us before assuming it is missing.
      </p>

      <h3>How you are billed</h3>
      <p>
        Purchases made on placeandplenty.com are billed by us through our
        payment provider and are managed in your account here. Purchases made
        through the Apple App Store or Google Play are billed by that store,
        governed by that store&rsquo;s terms as well as these, and are managed
        and cancelled in that store rather than with us. We never see your
        card details in either case. An annual subscription renews
        automatically unless you turn renewal off before the term ends,
        wherever you bought it.
      </p>

      <h3>Refunds</h3>
      <p>
        Refunds for a purchase made through the Apple App Store or Google Play
        are handled by that store, under its own policy, and we cannot issue
        one directly. Refunds for a purchase made on placeandplenty.com are
        handled by us. Either way, if something has gone wrong, write to us
        and we will help you sort it out.
      </p>


      <h2>AI features — please read this one</h2>
      <p>
        Several features use AI to make suggestions: preparation plans,
        recipes and quantities, styling ideas, soundtracks, and Space Mode&rsquo;s
        analysis of a room. Suggestions are suggestions. They can be wrong.
      </p>
      <p>
        <strong>
          You are responsible for food safety, allergies and dietary
          requirements.
        </strong>{" "}
        Do not rely on Place &amp; Plenty to keep a guest safe. Check
        ingredients and allergens yourself, and confirm anything that
        matters directly with the person it affects.
      </p>
      <p>
        The weather outlook is drawn from the US National Weather Service and
        is provided for convenience. It is a forecast, not a promise, and it
        is only available where that service has coverage.
      </p>

      <h2>Availability</h2>
      <p>
        We are still building. Features may change, and parts of the service
        may be unavailable from time to time. We will try not to surprise you
        with removals of things you depend on.
      </p>

      <h2>Ending things</h2>
      <p>
        You can stop using Place &amp; Plenty at any time and delete your
        account from{" "}
        <strong>Settings &rarr; Delete my account</strong>, or by following{" "}
        <Link href="/delete-account">these instructions</Link>. Deleting your
        account deletes the gatherings you own, including access and
        contributions belonging to any co-host, and it cannot be undone.
      </p>
      <p>
        We may suspend or close an account that breaks these terms or puts
        other people at risk. Where it is reasonable to do so, we will tell
        you why first.
      </p>

      <h2>What we do not promise</h2>
      <p>
        Place &amp; Plenty is provided &ldquo;as is&rdquo;. To the fullest
        extent the law allows, we do not make warranties that the service
        will be uninterrupted, error-free, or that its suggestions will suit
        your particular gathering.
      </p>
      <p>
        To the fullest extent the law allows, we are not liable for indirect
        or consequential losses, and our total liability to you is limited to
        the amount you paid us in the twelve months before the claim. Nothing
        here limits liability that cannot be limited by law. The precise
        wording of this section is under review.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        If we change these terms we will update the date at the top, and for
        anything significant we will tell you in the app. Continuing to use
        Place &amp; Plenty after a change means you accept it.
      </p>

      <h2>Governing law</h2>
      <p>
        The governing law and the venue for disputes are under review and
        will be published here before public launch.
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
