import { Task, Milestone } from "@/types";
import { Module, ModuleItem } from "@/types/course";

/**
 * Transforms course milestones to module format for consistent UI rendering
 * 
 * @param milestones - Array of course milestones with tasks
 * @returns Array of modules with their items
 */
export function transformMilestonesToModules(milestones: Milestone[] | undefined): Module[] {
  if (!milestones || !Array.isArray(milestones)) {
    return [];
  }

  const transformedModules = milestones.map((milestone: Milestone) => {
    // Map tasks to module items if they exist
    const moduleItems: ModuleItem[] = [];

    if (milestone.tasks && Array.isArray(milestone.tasks)) {
      milestone.tasks.forEach((task: Task) => {
        if (task.type === 'learning_material') {
          moduleItems.push({
            id: task.id.toString(),
            title: task.title,
            position: task.ordering,
            type: 'material',
            content: task.content || [], // Use content if available or empty array
            status: task.status,
            scheduled_publish_at: task.scheduled_publish_at,
            isGenerating: task.is_generating
          });
        } else if (task.type === 'quiz') {
          moduleItems.push({
            id: task.id.toString(),
            title: task.title,
            position: task.ordering,
            type: 'quiz',
            questions: task.questions || [], // Use questions if available or empty array
            status: task.status,
            numQuestions: task.num_questions,
            scheduled_publish_at: task.scheduled_publish_at,
            isGenerating: task.is_generating
          });
        } else if (task.type === 'assignment') {
          moduleItems.push({
            id: task.id.toString(),
            title: task.title,
            position: task.ordering,
            type: 'assignment',
            status: task.status,
            scheduled_publish_at: task.scheduled_publish_at,
            isGenerating: task.is_generating
          });
        }
      });

      // Sort items by position/ordering
      moduleItems.sort((a, b) => a.position - b.position);
    }

    return {
      id: milestone.id.toString(),
      title: milestone.name,
      position: milestone.ordering,
      items: moduleItems,
      isExpanded: false,
      backgroundColor: `${milestone.color}80`, // Add 50% opacity for UI display
      unlockAt: milestone.unlock_at
    };
  });

  // Sort modules by position/ordering
  const sortedModules = transformedModules.sort((a, b) => a.position - b.position);
  
  // Set the first module to be expanded by default if modules exist
  if (sortedModules.length > 0) {
    sortedModules[0].isExpanded = true;
  }
  
  return sortedModules;
}

/**
 * Transforms a course object with milestones to modules format
 * 
 * @param course - Course object with milestones array
 * @returns Array of modules
 */

export function transformCourseToModules(course: { milestones?: Milestone[] } | null | undefined): Module[] {
  if (!course) {
    return [];
  }

  return transformMilestonesToModules(course.milestones);
}