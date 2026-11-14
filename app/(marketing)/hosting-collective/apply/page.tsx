import type { Metadata } from 'next';
import CollectiveIntake from '@/components/CollectiveIntake';
export const metadata: Metadata = { title: 'Hosting Collective Partner Application', robots: { index: false, follow: false } };
export default function ApplyCollective() { return <CollectiveIntake kind="apply" />; }
