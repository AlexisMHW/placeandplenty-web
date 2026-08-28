import qrcode from "qrcode-generator";

// A QR code rendered as inline SVG, generated on the server at build
// time. No image request, no third-party generator service, nothing for a
// CSP to allow, and it stays crisp at any size — which matters because
// this is the one thing on the page a person points a camera at.
//
// Error correction level M (~15% recoverable) is the usual choice for a
// screen-displayed code: H would survive a logo punched into the middle,
// but nothing is overlaid here and the extra modules only make it denser
// and harder to scan at small sizes.
//
// Type 0 lets the encoder pick the smallest version that fits the data.
//
// ACCESSIBILITY. A QR code is unusable to a screen-reader user and to
// anyone on the device that would be scanning it, so the SVG is hidden
// from assistive technology. The destination must always be offered as a
// real link beside it — see AppDownload, which does exactly that. A QR
// code is never the only route to its own URL.

export default function QrCode({
  value,
  size = 132,
  className = "",
}: {
  value: string;
  /** Rendered edge in CSS pixels. The SVG itself is resolution-free. */
  size?: number;
  className?: string;
}) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();

  const count = qr.getModuleCount();
  // One module of quiet zone on each side. The spec asks for four, but
  // the card around this code already supplies generous padding in the
  // same colour, so four more would only shrink the modules.
  const quiet = 1;
  const dim = count + quiet * 2;

  // One path for every dark module beats one <rect> each: a 29×29 code is
  // ~400 dark modules, and 400 elements is a needlessly large DOM for
  // something decorative.
  let path = "";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
      }
    }
  }

  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={dim} height={dim} fill="#FAF8F3" />
      <path d={path} fill="#1F3D2E" />
    </svg>
  );
}
