import { redirect } from 'next/navigation';
import { reviewPageNumber } from '@/lib/collective-submissions';
export const dynamic = 'force-dynamic';
export default function FormerReview({searchParams}:{searchParams:{page?:string}}) {
  redirect(`/command-center/applications?page=${reviewPageNumber(searchParams.page)}`);
}
