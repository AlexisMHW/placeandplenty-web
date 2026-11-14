# Browser tests against QA (for Alexis)

**What this is:** a set of automatic browser tests that open the Place & Plenty website (pointed at the QA project), click through it like a person, and save screenshots. **What it is not:** proof that the released iPhone or Android apps work. Every test is labeled "browser test against QA".

## One-time setup (about 10 minutes)
1. Install Node.js "LTS" from nodejs.org if you do not have it.
2. Put this `qa-browser` folder inside the website project at `e2e\qa-browser` (so `package.json` of the website is two folders up). Use the website branch you want tested.
3. In Windows, set three environment variables (Start menu → "Edit environment variables for your account"):
   - `QA_SUPABASE_URL` (the QA project address; must contain `gpzlytukyvshrrxrmooo`)
   - `QA_SUPABASE_ANON_KEY` (the QA project's public "anon" key)
   - `QA_E2E_CREDENTIALS_FILE` (full path to your copy of the disposable QA test-account file)
   You never paste these into chat. If a value is missing the runner stops before doing anything.

## Run it
Open PowerShell in this folder and run exactly:

    powershell -ExecutionPolicy Bypass -File run-qa-browser-tests.ps1

Public-pages-and-privacy tests only (no test account needed):

    powershell -ExecutionPolicy Bypass -File run-qa-browser-tests.ps1 -PublicOnly

It takes a few minutes the first time (it installs tools). Leave the computer alone while it runs. At the end it prints where it saved `qa-browser-results-<date>.zip`. Send me that zip. It contains screenshots, a results summary and the list of test objects created; it contains no keys or passwords.

## What it covers
| ID | Test |
|---|---|
| P01–P06 | Sign-up page (no account created), log-in error, signed-out redirect, unknown invitation and gallery links, signed-out Command Center refusal |
| PR-* | Privacy: guest-link tokens, sign-in codes, e-mail addresses and names never appear in requests to Google or PostHog (those requests are blocked and recorded, never sent), for a visitor who has made no choice, declined, or accepted. A built-in canary proves the detector works |
| H01–H09 | Sign in as the disposable host; create a one-day gathering (8-step wizard); create a multi-day gathering (records whether it lands on the gathering or the Multi-Day checkout); "I'm not sure yet" guest count; add a guest; open the invitation page from the guest link and RSVP yes; host sees the answer; share-by-text (web has none: reported as "not in this build"); list everything created |
| CC01 | A signed-in non-staff account is refused at `/command-center` (reported "not in this build" if the page does not exist) |

## Honest limits
- Only the QA project is allowed. The runner and the tests both refuse any other project and stop before running.
- Tests create objects named `E2E-QA …` in QA. They are listed in `test-results\created-objects.json` so I can remove them by exact id. Please do not delete them by hand.
- A test that fails is information about the website, not a problem with your computer.
- Where a feature is not in the build under test, the result says **NOT IN THIS BUILD** instead of passing.
