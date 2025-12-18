import ClientCohortPage from '@/app/school/admin/[id]/cohorts/[cohortId]/ClientCohortPage';
import { redirect } from 'next/navigation';

export default async function CohortPage({
    params,
}: {
    params: Promise<{ id: string; cohortId: string }>;
}) {
    const { id, cohortId } = await params;
    // If cohortId is undefined or the string 'undefined', redirect to the school page
    if (!cohortId || cohortId === 'undefined') {
        console.error("Invalid cohortId in URL:", cohortId);
        redirect(`/school/admin/${id}#cohorts`);
    }

    return <ClientCohortPage schoolId={id} cohortId={cohortId} />;
} 