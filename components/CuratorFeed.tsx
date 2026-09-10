"use client";

import { useEffect, useRef, useState } from "react";

const FEED_ID = "d5ae8a92-bf4f-4a01-8574-f69ae84ddfbd";
const DOCUMENT = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent;color:#203d30;font-family:Arial,sans-serif}#feed-shell{display:flow-root;padding:2px}a{color:#203d30}.crt-logo{display:inline-block;padding:12px 0;font-size:12px}</style></head><body><div id="feed-shell"><div id="curator-feed-default-feed-layout"><a href="https://curator.io" target="_blank" rel="noopener noreferrer" class="crt-logo crt-tag">Powered by Curator.io</a></div></div><script>new ResizeObserver(function(){parent.postMessage({type:"pp-curator-height",height:document.getElementById("feed-shell").getBoundingClientRect().height},parent.location.origin)}).observe(document.getElementById("feed-shell"));</script><script async charset="UTF-8" src="https://cdn.curator.io/published/${FEED_ID}.js"></script></body></html>`;

/** Isolate vendor styles and lifecycle from the website's shared layout. */
export default function CuratorFeed() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    function resize(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return;
      if (event.data?.type !== "pp-curator-height" || typeof event.data.height !== "number" || !Number.isFinite(event.data.height)) return;
      setHeight(Math.max(200, Math.min(12000, Math.ceil(event.data.height) + 16)));
    }
    window.addEventListener("message", resize);
    return () => window.removeEventListener("message", resize);
  }, []);

  return <div className="mt-8 rounded-2xl border border-gold/40 bg-cream p-4 sm:p-6">
    <iframe ref={frame} title="Place & Plenty social gallery" srcDoc={DOCUMENT} loading="lazy" allowFullScreen className="block w-full border-0" style={{ height }} />
    <p className="mt-4 border-t border-sage/30 pt-4 font-body text-sm leading-relaxed text-forest/75">More moments, more ideas, more good company. <a href="https://instagram.com/placeandplenty" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline underline-offset-4">Follow @placeandplenty on Instagram</a>.</p>
  </div>;
}
