// BRAND-COLLABORATION READINESS. Pure checklist computed from data a creator has already given; it invents nothing and stores nothing.
// "Ready" means a staff member could responsibly offer this creator a campaign; it is not a ranking or a promise of work.
export interface CreatorFacts { approved: boolean; platforms: number; niches: number; audienceSummary: string; collaborationInterest: number; hasApprovedContent: boolean; hasUsagePermission: boolean; disclosureAcknowledged: boolean }
export interface ReadinessItem { key: string; label: string; done: boolean }
export function brandReadiness(f: CreatorFacts): { items: ReadinessItem[]; ready: boolean; missing: string[] } {
  const items: ReadinessItem[] = [
    { key: "approved", label: "Approved member", done: f.approved },
    { key: "platforms", label: "At least one platform listed", done: f.platforms > 0 },
    { key: "niches", label: "At least one niche chosen", done: f.niches > 0 },
    { key: "audience", label: "Audience described", done: f.audienceSummary.trim().length >= 20 },
    { key: "interest", label: "Collaboration interests chosen", done: f.collaborationInterest > 0 },
    { key: "content", label: "At least one approved content piece", done: f.hasApprovedContent },
    { key: "disclosure", label: "Disclosure rules acknowledged", done: f.disclosureAcknowledged },
    { key: "usage", label: "Usage permission on file for at least one piece (optional for outreach, needed to repost)", done: f.hasUsagePermission },
  ];
  const required = items.filter((i) => i.key !== "usage");
  return { items, ready: required.every((i) => i.done), missing: required.filter((i) => !i.done).map((i) => i.label) };
}
