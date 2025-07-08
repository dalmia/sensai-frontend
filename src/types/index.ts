// Define interfaces for Task-related data
export interface TaskData {
    id: string;
    title: string;
    blocks: any[];
    status: string;
    scheduled_publish_at?: string;
}

export interface Member {
    id: number;
    email: string;
}

export interface CohortMember extends Member {
    role: 'learner' | 'mentor';
}

export interface TeamMember extends Member {
    role: 'owner' | 'admin';  // Updated roles as per requirement
}

export interface Course {
    id: number;
    name: string;
}

export interface Cohort {
    id: number;
    name: string;
    joined_at: string | undefined;
    role?: string;
}

export interface CohortWithDetails extends Cohort {
    members: CohortMember[];
    org_id: number;
    name: string;
    groups: any[];
    courses?: Course[];
}

export interface Task {
    id: number;
    title: string;
    type: string;
    status: string;
    ordering: number;
    content?: any[]; // Content for learning materials
    num_questions?: number;
    questions?: any[]; // Questions for quizzes and exams
    scheduled_publish_at: string;
    is_generating: boolean;
}

export interface Milestone {
    id: number;
    name: string;
    color: string;
    ordering: number;
    tasks?: Task[];
    unlock_at?: string;
}

// Export all quiz types
export * from './quiz';

// Export other types as needed 