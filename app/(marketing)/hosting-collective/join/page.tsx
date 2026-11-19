import type { Metadata } from 'next';
import CollectiveIntake from '@/components/CollectiveIntake';
export const metadata: Metadata = { title: 'Join the Hosting Collective', robots: { index: false, follow: false } };
export default function JoinCollective() { return <CollectiveIntake kind="join" />; }
