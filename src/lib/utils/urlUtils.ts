import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Updates the URL with taskId and questionId query parameters
 * @param router - Next.js router instance
 * @param taskId - Task ID to set in URL (null to remove)
 * @param questionId - Question ID to set in URL (null to remove)
 */
export const updateTaskAndQuestionIdInUrl = (
    router: AppRouterInstance,
    taskId: string | null,
    questionId: string | null,
) => {
    // Only update URL if the parameters are different from current URL
    const currentUrl = new URL(window.location.href);
    const currentTaskId = currentUrl.searchParams.get('taskId');
    const currentQuestionId = currentUrl.searchParams.get('questionId');

    // If both are the same as current, do nothing
    if (currentTaskId === taskId && currentQuestionId === questionId) {
        return;
    }

    const url = new URL(window.location.href);

    if (taskId) {
        url.searchParams.set('taskId', taskId);
    } else {
        url.searchParams.delete('taskId');
    }

    if (questionId) {
        url.searchParams.set('questionId', questionId);
    } else {
        url.searchParams.delete('questionId');
    }

    router.push(url.pathname + url.search, { scroll: false }); 
};
