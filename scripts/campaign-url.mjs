// External campaign links only. Never put UTMs on navigation within P&P.
const [destination, source, medium, campaign, content] = process.argv.slice(2);
const allowedMedia = new Set(['social', 'email', 'referral', 'cpc', 'paid_social']);
const valid = (value) => typeof value === 'string' && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value);
try {
  const url = new URL(destination, 'https://placeandplenty.com');
  if (url.origin !== 'https://placeandplenty.com' || !valid(source) || !allowedMedia.has(medium) || !valid(campaign) || (content !== undefined && !valid(content))) throw new Error('Invalid campaign values');
  for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key);
  for (const [key, value] of Object.entries({ source, medium, campaign, content })) if (value) url.searchParams.set(`utm_${key}`, value);
  console.log(url.href);
} catch {
  console.error('Usage: node scripts/campaign-url.mjs /landing-path instagram social before_the_doorbell bio');
  console.error('Use lowercase letters, numbers and underscores. Medium: social, email, referral, cpc, paid_social. Destination must be on https://placeandplenty.com.');
  process.exitCode = 1;
}
