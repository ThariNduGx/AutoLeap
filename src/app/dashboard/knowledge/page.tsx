import { redirect } from 'next/navigation';

/**
 * /dashboard/knowledge → /dashboard/faqs
 * The full FAQ management UI lives at /dashboard/faqs.
 */
export default function KnowledgePage() {
    redirect('/dashboard/faqs');
}
