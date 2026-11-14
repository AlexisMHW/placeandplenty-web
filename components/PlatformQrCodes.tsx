import QrCode from "@/components/QrCode";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-links";

/** Each code encodes its labeled store URL; the link is usable on the same phone. */
export default function PlatformQrCodes({ className = "" }: { className?: string }) {
  const stores = [
    { label: "iPhone · App Store", href: APP_STORE_URL, action: "Download for iPhone" },
    { label: "Android · Google Play", href: PLAY_STORE_URL, action: "Get it for Android" },
  ];

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {stores.map(({ label, href, action }) => href && (
        <div key={label} className="min-w-0 rounded-2xl border border-sage/35 bg-offwhite p-3 text-center text-forest shadow-softer">
          <p className="mb-2 font-body text-xs font-semibold">{label}</p>
          <div className="mx-auto w-full max-w-[144px]">
            <QrCode value={href} size={144} className="h-auto w-full" />
          </div>
          <a href={href} className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded font-body text-xs underline decoration-gold underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
            {action}
          </a>
        </div>
      ))}
    </div>
  );
}
