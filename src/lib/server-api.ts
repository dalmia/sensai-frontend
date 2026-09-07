import { transformMilestonesToModules } from "./course";
import { backendFetch } from "@/lib/server/backendFetch";

/**
 * Fetches course data and transforms it into modules (server-side version)
 * @param courseId - The ID of the course
 * @param baseUrl - The base URL for the API request
 * @returns Object containing the course data and transformed modules
 */
export const getPublishedCourseModules = async (courseId: string): Promise<{
  courseData: any,
  modules: any[]
}> => {
  const response = await backendFetch(`/courses/${courseId}?only_published=true`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch course data: ${response.status}`);
  }

  const courseData = await response.json();
  
  // Use the shared utility function to transform the milestones to modules
  const modules = transformMilestonesToModules(courseData.milestones);

  return { courseData, modules };
}; 