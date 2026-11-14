#!/usr/bin/env python3
"""
Local-browser verification of analytics privacy (GA4 + PostHog). NOT live analytics traffic.

What is real: the app under test (baseline = unpatched HEAD layout, patched = consent-gating patch) runs in
real Chromium (Playwright). The real posthog-js library (npm posthog-js, served in place of the CDN array.js,
which the sandbox cannot reach) executes and tries to send real network requests, which are intercepted and
recorded (URL, decoded body) instead of leaving the sandbox. A worst-case PostHog remote config (session
recording ON, autocapture ON, surveys ON) is returned to prove client-side settings override project settings.
What is NOT real: Google's gtag.js (googletagmanager.com returns 403 through the sandbox proxy, not worked around),
so GA4 is verified from the script request + the dataLayer commands the app issues, not from gtag's own hits.
Usage: privacy_network_verify.py <baseline|patched> <base_url> <out.json> <posthog_dist_dir>
"""
import sys, json, gzip, zlib, base64, re, os, time, urllib.parse
from playwright.sync_api import sync_playwright

label, BASE, OUT, PH_DIST = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3], sys.argv[4]

SECRETS = ["FAKEINVITETOKEN123", "FAKEGALLERYTOKEN456", "FAKECOHOSTTOKEN789", "FAKEAUTHCODE",
           "betsy@example.com", "betsy%40example.com", "Betsy", "Hughes"]

URLS = {
  "invite":      "/invite/FAKEINVITETOKEN123",
  "gallery":     "/gallery/FAKEGALLERYTOKEN456",
  "cohost":      "/host/co-host-invite/FAKECOHOSTTOKEN789",
  "auth_cb":     "/auth/callback?code=FAKEAUTHCODE",
  "email_query": "/pricing?email=betsy@example.com&name=Betsy%20Hughes&utm_source=newsletter&ref=creator1",
  "privacy":     "/privacy",
}

CONSENT_KEY, CONSENT_VER = "pp_analytics_consent_v1", "2026-11-13"
def stored(choice): return json.dumps({"choice": choice, "version": CONSENT_VER, "at": "2026-11-13T00:00:00Z"})

SCENARIOS = {
  "fresh": {},                                             # no stored choice (also baseline default)
  "granted": {"stored": stored("granted")},
  "declined": {"stored": stored("denied")},
  "gpc_with_granted": {"stored": stored("granted"), "gpc": True},
  "dnt_with_granted": {"stored": stored("granted"), "dnt": True},
}
if label == "baseline":
    SCENARIOS = {"fresh": {}}

WORST_CASE_REMOTE_CONFIG = {
  "config": {"enable_collect_everything": True}, "toolbarParams": {}, "isAuthenticated": False,
  "supportedCompression": ["gzip-js"], "hasFeatureFlags": False, "captureDeadClicks": True,
  "capturePerformance": {"network_timing": True, "web_vitals": True}, "autocapture_opt_out": False,
  "autocaptureExceptions": False, "surveys": True, "heatmaps": True,
  "sessionRecording": {"endpoint": "/s/", "consoleLogRecordingEnabled": True, "recorderVersion": "v2",
                       "sampleRate": None, "minimumDurationMilliseconds": 0, "linkedFlag": None,
                       "networkPayloadCapture": None, "masking": None, "urlTriggers": [], "urlBlocklist": [],
                       "eventTriggers": [], "triggerMatchType": None, "scriptConfig": {"script": "posthog-recorder"}},
  "flags": {}, "featureFlags": {}, "featureFlagPayloads": {}, "errorsWhileComputingFlags": False,
}

def decode_body(buf):
    if not buf: return ""
    for fn in (lambda b: gzip.decompress(b), lambda b: zlib.decompress(b)):
        try: return fn(buf).decode("utf-8", "replace")
        except Exception: pass
    try: return buf.decode("utf-8", "replace")
    except Exception: return repr(buf[:200])

def events_from_body(text):
    try:
        data = json.loads(text)
    except Exception:
        m = re.search(r"data=([^&]+)", text)
        if m:
            try: data = json.loads(base64.b64decode(urllib.parse.unquote(m.group(1))))
            except Exception: return []
        else: return []
    if isinstance(data, dict) and "batch" in data: data = data["batch"]
    if isinstance(data, dict): data = [data]
    out = []
    for e in data if isinstance(data, list) else []:
        if isinstance(e, dict):
            p = e.get("properties", {}) or {}
            out.append({"event": e.get("event"), "current_url": p.get("$current_url"), "pathname": p.get("$pathname"),
                        "elements_chain": (p.get("$elements_chain") or "")[:300], "prop_keys": sorted(p.keys())[:60]})
    return out

def run_one(pw, scenario_name, scenario, key, path):
    browser = pw.chromium.launch(args=["--disable-blink-features=AutomationControlled"])
    # posthog-js ignores HeadlessChrome user agents (bot filter); present a normal desktop Chrome UA so real capture is exercised
    ctx_kwargs = {"user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "viewport": {"width": 1280, "height": 900}}
    ctx = browser.new_context(**ctx_kwargs)
    init = ["Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>false,configurable:true});",
            "Object.defineProperty(Navigator.prototype,'userAgentData',{get:()=>undefined,configurable:true});"]  # test realism: real users are not webdriver/HeadlessChrome; posthog-js drops events from automated browsers
    if "stored" in scenario:
        init.append(f"try{{localStorage.setItem({json.dumps(CONSENT_KEY)},{json.dumps(scenario['stored'])})}}catch(e){{}}")
    if scenario.get("gpc"):
        init.append("Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true,configurable:true});")
    if scenario.get("dnt"):
        init.append("Object.defineProperty(Navigator.prototype,'doNotTrack',{get:()=>'1',configurable:true});")
    if os.environ.get("PV_DEBUG"): init.append("try{localStorage.setItem('ph_debug','true')}catch(e){}")
    for s in init: ctx.add_init_script(s)
    page = ctx.new_page()
    console_lines = []
    page.on("console", lambda m: console_lines.append(m.text[:220]) if os.environ.get("PV_DEBUG") else None)
    rec = {"analytics_requests": [], "other_blocked": []}

    def handle(route):
        req = route.request
        url = req.url
        host = urllib.parse.urlparse(url).netloc
        if host.startswith(("127.0.0.1", "localhost")):
            return route.continue_()
        item = {"method": req.method, "url": url}
        if "posthog-assets.i.posthog.com" in host or host.startswith("us-assets.i.posthog.com"):
            fname = urllib.parse.urlparse(url).path.split("/")[-1]
            item["kind"] = "posthog_asset"; item["file"] = fname
            rec["analytics_requests"].append(item)
            f = os.path.join(PH_DIST, fname)
            pth = urllib.parse.urlparse(url).path
            if pth.startswith("/array/") and pth.endswith("/config"):
                return route.fulfill(status=200, content_type="application/json", body=json.dumps(WORST_CASE_REMOTE_CONFIG))
            if pth.startswith("/array/") and pth.endswith("/config.js"):
                tok = pth.split("/")[2]
                js = "(function(){window._POSTHOG_REMOTE_CONFIG=window._POSTHOG_REMOTE_CONFIG||{};window._POSTHOG_REMOTE_CONFIG[%s]={config:%s,siteApps:[]};})();" % (json.dumps(tok), json.dumps(WORST_CASE_REMOTE_CONFIG))
                return route.fulfill(status=200, content_type="application/javascript", body=js)
            if os.path.exists(f):
                return route.fulfill(status=200, content_type="application/javascript", body=open(f, "rb").read())
            return route.fulfill(status=404, body="")
        if host.endswith("posthog.com"):
            body = decode_body(req.post_data_buffer)
            item["kind"] = "posthog_api"; item["body_len"] = len(body)
            item["events"] = events_from_body(body)
            item["body_contains_secret"] = [s for s in SECRETS if s.lower() in (url + body).lower()]
            rec["analytics_requests"].append(item)
            p = urllib.parse.urlparse(url).path
            if "/flags" in p or "/decide" in p:
                return route.fulfill(status=200, content_type="application/json", body=json.dumps(WORST_CASE_REMOTE_CONFIG))
            return route.fulfill(status=200, content_type="application/json", body='{"status":1}')
        if "googletagmanager.com" in host or "google-analytics.com" in host or "analytics.google.com" in host or "doubleclick" in host:
            item["kind"] = "ga_request"
            item["secret_in_url"] = [s for s in SECRETS if s.lower() in url.lower()]
            rec["analytics_requests"].append(item)
            if "googletagmanager.com/gtag/js" in url:
                return route.fulfill(status=200, content_type="application/javascript", body="/* gtag.js not available in sandbox (stubbed empty) */")
            return route.fulfill(status=204, body="")
        rec["other_blocked"].append(url[:140])
        return route.abort()
    seen_all = []
    def on_req(req):
        host = urllib.parse.urlparse(req.url).netloc
        if host.endswith(("posthog.com", "google-analytics.com", "googletagmanager.com", "analytics.google.com", "doubleclick.net")):
            try: body = decode_body(req.post_data_buffer)
            except Exception: body = ""
            seen_all.append({"method": req.method, "url": req.url, "type": req.resource_type, "body_len": len(body),
                             "events": events_from_body(body) if body else [],
                             "secret_hits": [x for x in SECRETS if x.lower() in (req.url + body).lower()]})
    ctx.on("request", on_req)
    ctx.route("**/*", handle)

    full = BASE + path
    try:
        page.goto(full, wait_until="domcontentloaded", timeout=120000)
    except Exception as e:
        rec["goto_error"] = str(e)[:200]
    page.wait_for_timeout(6000)
    # inject a clickable element carrying a fake guest name + email text, then click it (autocapture probe)
    try:
        page.evaluate("""()=>{const a=document.createElement('a');a.id='pv-probe';a.href='#probe';a.textContent='Betsy Hughes betsy@example.com RSVP';a.style.cssText='display:block;padding:20px;position:relative;z-index:99999;background:#fff';document.body.prepend(a);}""")
        page.click("#pv-probe", timeout=5000)
    except Exception as e:
        rec["probe_error"] = str(e)[:120]
    page.wait_for_timeout(6000)
    # in-page state
    state = page.evaluate("""()=>({
        final_url: location.href,
        pp_loaded: !!window.__ppAnalyticsLoaded,
        banner: !!document.querySelector('[aria-label="Analytics choice"]'),
        dataLayer: (window.dataLayer||[]).map(x=>{try{return JSON.stringify(Array.from(x))}catch(e){return String(x)}}).slice(0,20),
        ph_present: !!(window.posthog && window.posthog.config),
        ph_cfg: (window.posthog && window.posthog.config) ? {
           autocapture: window.posthog.config.autocapture, disable_session_recording: window.posthog.config.disable_session_recording,
           disable_surveys: window.posthog.config.disable_surveys, mask_all_text: window.posthog.config.mask_all_text,
           mask_all_element_attributes: window.posthog.config.mask_all_element_attributes, persistence: window.posthog.config.persistence,
           capture_pageview: window.posthog.config.capture_pageview, respect_dnt: window.posthog.config.respect_dnt,
           person_profiles: window.posthog.config.person_profiles, api_host: window.posthog.config.api_host } : null,
        ph_recording_started: (window.posthog && window.posthog.sessionRecordingStarted) ? window.posthog.sessionRecordingStarted() : null,
        ph_opted_out: (window.posthog && window.posthog.has_opted_out_capturing) ? window.posthog.has_opted_out_capturing() : null,
        gpc: navigator.globalPrivacyControl === true, dnt: navigator.doNotTrack || null,
        cookies: document.cookie.split(';').map(s=>s.trim().split('=')[0]).filter(Boolean),
        ls_keys: Object.keys(localStorage)
    })""")
    rec["state"] = state
    if os.environ.get("PV_DEBUG"): rec["console"] = console_lines[:60]
    rec["seen_all"] = seen_all
    dl = " ".join(state.get("dataLayer", []))
    rec["datalayer_secrets"] = [s for s in SECRETS if s.lower() in dl.lower()]
    leaks = set(rec["datalayer_secrets"])
    for r in rec["analytics_requests"]:
        for s in r.get("body_contains_secret", []) + r.get("secret_in_url", []): leaks.add(s)
        for ev in r.get("events", []) or []:
            blob = json.dumps(ev)
            for s in SECRETS:
                if s.lower() in blob.lower(): leaks.add(s)
    for r in seen_all:
        for x in r["secret_hits"]: leaks.add(x)
        for ev in r["events"]:
            for x in SECRETS:
                if x.lower() in json.dumps(ev).lower(): leaks.add(x)
    rec["leaked_values"] = sorted(leaks)
    rec["requested_ga_script"] = any(r.get("kind") == "ga_request" and "gtag/js" in r["url"] for r in rec["analytics_requests"])
    rec["requested_posthog_array"] = any(r.get("file") == "array.js" for r in rec["analytics_requests"])
    rec["requested_posthog_recorder"] = any("recorder" in (r.get("file") or "") for r in rec["analytics_requests"])
    rec["posthog_event_names"] = sorted({e["event"] for r in seen_all for e in r["events"] if e.get("event")})
    rec["posthog_urls_sent"] = sorted({e["current_url"] for r in seen_all for e in r["events"] if e.get("current_url")})
    rec["posthog_recording_posts"] = [r["url"] for r in seen_all if urllib.parse.urlparse(r["url"]).path.startswith("/s/")]
    rec["posthog_capture_posts"] = [r["url"][:100] for r in seen_all if r["method"] == "POST" and urllib.parse.urlparse(r["url"]).path.startswith(("/e", "/batch", "/i/v0/e"))]
    browser.close()
    return rec

ONLY = os.environ.get("PV_ONLY")  # optional "scenario|key" filter for debugging
results = {"label": label, "base": BASE, "runs": {}}
with sync_playwright() as pw:
    for sname, sc in SCENARIOS.items():
        for key, path in URLS.items():
            if ONLY and f"{sname}|{key}" != ONLY: continue
            t = time.time()
            results["runs"][f"{sname}|{key}"] = run_one(pw, sname, sc, key, path)
            r = results["runs"][f"{sname}|{key}"]
            print(f"{label:8} {sname:17} {key:12} ga_script={r['requested_ga_script']!s:5} ph_array={r['requested_posthog_array']!s:5} "
                  f"banner={r['state']['banner']!s:5} leaks={r['leaked_values']} ({time.time()-t:.0f}s)", flush=True)
json.dump(results, open(OUT, "w"), indent=1)
