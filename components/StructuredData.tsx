import { BRAND_NAME, TAGLINE } from "@/lib/brand";
import { PRICING_TIERS } from "@/lib/pricing";

// JSON-LD, kept to the four types that actually earn their place (§19:
// "structured data where useful" — the qualifier is doing work).
//
// THE RULE APPLIED THROUGHOUT: only describe what is visible on the page
// and true of the product. Structured data that overstates gets a manual
// action, and more to the point it would put claims in machine-readable
// form that the rest of the site is careful not to make.
//
// Two consequences worth spelling out, because both look like omissions:
//
//   - Offer carries `availability: PreOrder`, not InStock. Nothing can be
//     bought yet; the app has no purchase flow. Marking a price InStock
//     would be a lie told to a shopping crawler.
//   - There is no AggregateRating anywhere. There are no reviews. Review
//     markup without reviews is the single most common cause of a
//     structured-data penalty.
//
// No Product/Offer markup is emitted on any page other than /pricing,
// where the prices are actually shown.

const ORG_ID = "https://placeandplenty.com/#organization";
const SITE_ID = "https://placeandplenty.com/#website";
const FOUNDER_ID = "https://placeandplenty.com/about#alexis-hughes-williams";
const APP_ID = "https://placeandplenty.com/#software";

const FOUNDER_DATA = {
  "@type": "Person",
  "@id": FOUNDER_ID,
  name: "Alexis Hughes-Williams",
  url: "https://placeandplenty.com/about",
  image:
    "https://placeandplenty.com/images/ChatGPT%20Image%20Sep%202%2C%202026%2C%2009_20_59%20AM.png",
  jobTitle: "Founder of Place & Plenty",
  worksFor: { "@id": ORG_ID },
  alumniOf: {
    "@type": "CollegeOrUniversity",
    name: "Tennessee State University",
  },
  knowsAbout: ["Home hosting", "Gathering planning", "Hospitality", "Marketing"],
  sameAs: [
    "https://www.linkedin.com/in/alexis-hughes-williams-924b6739",
    "https://www.somethingsweetllc.com/about/",
    "https://alexishugheswilliams.com",
    "https://citycurrent.com/2021/02/girl-unknown-inc-making-the-unknowns-known-in-finding-you/",
  ],
};

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // The payload is built from our own constants and CMS content, not
      // from user input. JSON.stringify escapes quotes; the `<` guard
      // closes the one remaining hole, a literal "</script>" inside a
      // string field breaking out of the tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** Organisation and site identity. Homepage only — it is site-wide. */
export function OrganizationSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": ORG_ID,
            name: BRAND_NAME,
            url: "https://placeandplenty.com",
            slogan: TAGLINE,
            description:
              "Place & Plenty helps you plan everything between “people are coming” and the doorbell ringing.",
            logo: "https://placeandplenty.com/images/pp-mark.png",
            founder: { "@id": FOUNDER_ID },
            sameAs: [
              "https://instagram.com/placeandplenty",
              "https://facebook.com/placeandplenty",
              "https://tiktok.com/@placeandplenty",
              "https://youtube.com/@placeandplenty",
            ],
          },
          FOUNDER_DATA,
          {
            "@type": "WebSite",
            "@id": SITE_ID,
            url: "https://placeandplenty.com",
            name: BRAND_NAME,
            publisher: { "@id": ORG_ID },
          },
          {
            "@type": "SoftwareApplication",
            "@id": APP_ID,
            name: BRAND_NAME,
            url: "https://placeandplenty.com",
            applicationCategory: "LifestyleApplication",
            operatingSystem: "Web",
            description:
              "A consumer home-hosting platform for invitations, RSVPs, guests, menus, shopping, contributions, space and gathering-day readiness.",
            publisher: { "@id": ORG_ID },
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              description: "Start planning one active gathering for free.",
            },
            featureList: [
              "Online invitations",
              "RSVP and guest list tracking",
              "Who’s Bringing What contributions",
              "Menu and shopping planning",
              "My Guest Book reusable contacts",
              "HostReady gathering readiness",
            ],
          },
        ],
      }}
    />
  );
}

/** An editorial piece — a Gathering Idea or a Coordinated Host article. */
export function ArticleSchema({
  headline,
  description,
  url,
  image,
  datePublished,
  dateModified,
}: {
  headline: string;
  description?: string | null;
  url: string;
  image?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline,
        description: description || undefined,
        url,
        image: image ? `https://placeandplenty.com${image}` : undefined,
        datePublished: datePublished || undefined,
        dateModified: dateModified || datePublished || undefined,
        author: FOUNDER_DATA,
        publisher: { "@id": ORG_ID },
        isPartOf: { "@id": SITE_ID },
      }}
    />
  );
}

/** A visible breadcrumb trail, used on public search landing pages. */
export function BreadcrumbSchema({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
}

/** Founder identity on the page where that experience is visible. */
export function FounderSchema() {
  return <JsonLd data={{ "@context": "https://schema.org", ...FOUNDER_DATA }} />;
}

/** Pricing. See the availability note at the top of this file. */
export function PricingSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: BRAND_NAME,
        description: "Home hosting planning for real gatherings.",
        brand: { "@id": ORG_ID },
        offers: PRICING_TIERS.map((tier) => ({
          "@type": "Offer",
          name: tier.name,
          price: tier.price.replace("$", ""),
          priceCurrency: "USD",
          description: tier.description,
          // Not purchasable yet, and the markup says so.
          availability: "https://schema.org/PreOrder",
          url: "https://placeandplenty.com/pricing",
        })),
      }}
    />
  );
}

/** Only for questions genuinely rendered as visible Q&A on the page. */
export function FaqSchema({
  faqs,
}: {
  faqs: { q: string; a: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }}
    />
  );
}
