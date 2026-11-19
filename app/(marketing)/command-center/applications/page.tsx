import type { Metadata } from 'next';
import CollectiveApplicationInbox from '@/components/CollectiveApplicationInbox';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata: Metadata = {title:'Collective applications | Command Center',robots:{index:false,follow:false}};
export default CollectiveApplicationInbox;
