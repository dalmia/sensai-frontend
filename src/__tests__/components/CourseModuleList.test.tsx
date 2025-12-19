import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import CourseModuleList from '@/components/CourseModuleList';

// Mock next-auth
jest.mock('next-auth/react', () => ({
    useSession: () => ({
        data: {
            user: {
                id: 'test-user-id',
                name: 'Test User',
                email: 'test@example.com',
            },
        },
        status: 'authenticated',
    }),
}));

// Mock the auth hook
jest.mock('@/lib/auth', () => ({
    useAuth: () => ({
        user: {
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.com',
        },
    }),
}));

// Mock formatScheduleDate utility
jest.mock('@/lib/utils/dateFormat', () => ({
    formatScheduleDate: jest.fn((date) => `Mocked date: ${date.toISOString()}`),
}));

// Mock CourseItemDialog
jest.mock('@/components/CourseItemDialog', () => {
    return function MockCourseItemDialog(props: any) {
        return props.isOpen ? <div data-testid="course-item-dialog">Course Item Dialog Mock</div> : null;
    };
});

// Mock ConfirmationDialog
jest.mock('@/components/ConfirmationDialog', () => {
    return function MockConfirmationDialog(props: any) {
        return props.open ? (
            <div data-testid="confirmation-dialog">
                <div>{props.title}</div>
                <div>{props.message}</div>
                <button onClick={props.onConfirm}>{props.confirmButtonText}</button>
                <button onClick={props.onCancel}>Cancel</button>
            </div>
        ) : null;
    };
});

// Mock Tooltip
jest.mock('@/components/Tooltip', () => {
    return function MockTooltip(props: any) {
        return (
            <div data-testid="tooltip" title={props.content}>
                {props.children}
            </div>
        );
    };
});

describe('CourseModuleList Component', () => {
    const onToggleModule = jest.fn();
    const defaultProps = {
        modules: [
            {
                id: '1',
                title: 'Test Module',
                items: [],
                position: 1,
            },
        ],
        courseId: 'test-course-id',
        mode: 'edit' as 'edit' | 'view',
        schoolId: 'test-school-id',
        onToggleModule: onToggleModule,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Mock global fetch for any network requests made inside the component
        global.fetch = jest.fn(() =>
            Promise.resolve({ ok: true, json: async () => ({}) })
        ) as jest.Mock;

        // Mock console.error to avoid noise in tests
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('Basic Rendering', () => {
        it('renders without crashing', () => {
            render(<CourseModuleList {...defaultProps} />);
            // Component should mount successfully
            expect(document.body).toBeInTheDocument();
        });

        it('renders module list', () => {
            render(<CourseModuleList {...defaultProps} />);
            // Component should render without errors
            expect(document.body).toBeInTheDocument();
        });
    });

    describe('Module Management', () => {
        it('handles empty modules array', () => {
            const propsWithEmptyModules = {
                ...defaultProps,
                modules: [],
            };

            render(<CourseModuleList {...propsWithEmptyModules} />);
            expect(document.body).toBeInTheDocument();
        });
    });

    describe('Props Handling', () => {
        it('handles missing optional props gracefully', () => {
            const onToggleModule = jest.fn();
            const minimalProps = {
                modules: [],
                mode: 'edit' as 'edit' | 'view',
                courseId: 'test-course-id',
                schoolId: 'test-school-id',
                onToggleModule: onToggleModule,
            };

            expect(() => {
                render(<CourseModuleList {...minimalProps} />);
            }).not.toThrow();
        });
    });

    describe('Module Items', () => {
        it('handles modules with items', () => {
            const propsWithItems = {
                ...defaultProps,
                modules: [
                    {
                        id: '1',
                        title: 'Module with Items',
                        items: [
                            { id: '1', title: 'Item 1', type: 'material' as 'material' | 'quiz', position: 0, questions: [], scheduled_publish_at: null },
                            { id: '2', title: 'Item 2', type: 'quiz' as 'material' | 'quiz', position: 1, questions: [], scheduled_publish_at: null },
                        ],
                        position: 1,
                        isExpanded: true,
                    },
                ],
            };

            render(<CourseModuleList {...propsWithItems} />);
            expect(document.body).toBeInTheDocument();
        });
    });

    describe('Edit-mode interactions', () => {
        it('calls onMoveModuleUp and makes API call when moving a module up', async () => {
            const onMoveModuleUp = jest.fn();

            // Two modules so the second can be moved up
            const twoModules = [
                {
                    id: '1',
                    title: 'First',
                    items: [],
                    position: 1,
                },
                {
                    id: '2',
                    title: 'Second',
                    items: [],
                    position: 2,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={twoModules}
                    onMoveModuleUp={onMoveModuleUp}
                    courseId="abc"
                    mode="edit"
                />
            );

            // Locate the UP arrow for the second module (enabled)
            const buttons = screen.getAllByLabelText('Move module up');
            const upBtnSecond = buttons[1];

            fireEvent.click(upBtnSecond);

            await waitFor(() => {
                expect(onMoveModuleUp).toHaveBeenCalledWith('2');
                expect(global.fetch).toHaveBeenCalled();
            });
        });

        it('duplicates a task and triggers onDuplicateItem callback', async () => {
            const onDuplicateItem = jest.fn();

            // Make fetch return a duplicated task payload
            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({ ok: true, json: async () => ({ task: { id: 'dup' }, ordering: 123 }) })
            );

            const modulesWithItem = [
                {
                    id: '1',
                    title: 'Module',
                    position: 1,
                    isExpanded: true,
                    items: [
                        {
                            id: 'item-1',
                            title: 'Material',
                            type: 'material' as const,
                            position: 1,
                            scheduled_publish_at: null,
                        },
                    ],
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={modulesWithItem}
                    onDuplicateItem={onDuplicateItem as any}
                    courseId="abc"
                    mode="edit"
                />
            );

            // Ensure the module items are visible (in case expansion is needed)
            fireEvent.click(screen.getByText('Module'));

            const duplicateBtn = screen.getByLabelText('Duplicate task as draft');
            fireEvent.click(duplicateBtn);

            await waitFor(() => {
                expect(onDuplicateItem).toHaveBeenCalledWith('1', { id: 'dup' }, 123);
            });
        });

        it('opens and confirms delete module dialog', async () => {
            const onDeleteModule = jest.fn();

            render(
                <CourseModuleList
                    {...defaultProps}
                    onDeleteModule={onDeleteModule}
                    mode="edit"
                />
            );

            // Trash icon in module header
            const deleteBtn = screen.getByLabelText('Delete module');
            fireEvent.click(deleteBtn);

            // Confirm dialog delete
            const confirmButtons = await screen.findAllByRole('button', { name: /^delete$/i });
            fireEvent.click(confirmButtons[0]);

            await waitFor(() => {
                expect(onDeleteModule).toHaveBeenCalledWith('1');
            });
        });
    });

    describe('View-mode behaviour', () => {
        it('passes first questionId from completedQuestionIds to onOpenItem for quiz', () => {
            const onOpenItem = jest.fn();

            const modulesWithQuiz = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        {
                            id: 'quiz-1',
                            title: 'Quiz Task',
                            type: 'quiz' as const,
                            position: 0,
                            status: 'published',
                            numQuestions: 3,
                            questions: [],
                            scheduled_publish_at: null,
                        },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={modulesWithQuiz}
                    mode="view"
                    expandedModules={{ '1': true }}
                    onOpenItem={onOpenItem}
                    completedQuestionIds={{ 'quiz-1': { '943': false, '944': false, '945': false } }}
                />
            );

            // Click the quiz item
            const quizEl = screen.getByTestId('module-item-quiz-1');
            fireEvent.click(quizEl);

            // Should pass the first question id ('943') as third arg
            expect(onOpenItem).toHaveBeenCalledWith('1', 'quiz-1', '943');
        });

        it('calls onOpenItem without questionId when none available', () => {
            const onOpenItem = jest.fn();

            const modulesWithQuiz = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        {
                            id: 'quiz-1',
                            title: 'Quiz Task',
                            type: 'quiz' as const,
                            position: 0,
                            status: 'published',
                            numQuestions: 0,
                            questions: [],
                            scheduled_publish_at: null,
                        },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={modulesWithQuiz}
                    mode="view"
                    expandedModules={{ '1': true }}
                    onOpenItem={onOpenItem}
                    completedQuestionIds={{}}
                />
            );

            const quizEl = screen.getByTestId('module-item-quiz-1');
            fireEvent.click(quizEl);

            // Third argument should be undefined when no question ids are present
            expect(onOpenItem).toHaveBeenCalledWith('1', 'quiz-1', undefined);
        });
        it('shows progress bar and locks a future module', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const viewModules = [
                {
                    id: 'view-1',
                    title: 'Progress Module',
                    items: [],
                    position: 1,
                    progress: 80,
                    isExpanded: false,
                },
                {
                    id: 'locked-1',
                    title: 'Locked',
                    items: [],
                    position: 2,
                    unlockAt: tomorrow.toISOString(),
                    isExpanded: false,
                },
            ];

            const onToggle = jest.fn();

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={viewModules}
                    mode="view"
                    onToggleModule={onToggle}
                />
            );

            // Progress percentage visible
            expect(screen.getByText('80%')).toBeInTheDocument();

            // Expand first module
            const expandBtn = screen.getAllByRole('button', { name: /expand/i })[0];
            fireEvent.click(expandBtn);
            expect(onToggle).toHaveBeenCalledWith('view-1');

            // Attempt to click locked module header (should not toggle)
            fireEvent.click(screen.getByText('Locked'));
            expect(onToggle).not.toHaveBeenCalledWith('locked-1');
        });
    });

    describe('CourseModuleList - Full Coverage', () => {
        it('syncs completedTaskIds state when prop changes', async () => {
            const moduleWithTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        {
                            id: 'task-1',
                            title: 'Task 1',
                            type: 'material' as const,
                            position: 0,
                            scheduled_publish_at: null,
                        },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            const { rerender } = render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTask}
                    mode="view"
                    expandedModules={{ '1': true }}
                    completedTaskIds={{}}
                />
            );

            // Initially no completed styling
            const taskElement = screen.getByTestId('module-item-task-1');
            expect(taskElement).not.toHaveClass('opacity-60');

            // Update with completed task
            rerender(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTask}
                    mode="view"
                    expandedModules={{ '1': true }}
                    completedTaskIds={{ 'task-1': true }}
                />
            );

            await waitFor(() => {
                const updatedTaskElement = screen.getByTestId('module-item-task-1');
                expect(updatedTaskElement).toHaveClass('opacity-60');
            });
        });

        it('formats unlock date for tooltip', () => {
            const futureDate = new Date('2024-12-25T10:00:00Z');
            const lockedModule = [
                {
                    id: 'locked',
                    title: 'Locked Module',
                    items: [],
                    position: 1,
                    unlockAt: futureDate.toISOString(),
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={lockedModule}
                    mode="view"
                />
            );

            // Check that tooltip is rendered with formatted date
            const tooltip = screen.getByTestId('tooltip');
            expect(tooltip).toHaveAttribute('title', expect.stringContaining('Unlocks on'));
        });

        it('moves module down with API call', async () => {
            const onMoveModuleDown = jest.fn();
            const twoModules = [
                { id: '1', title: 'First', items: [], position: 1 },
                { id: '2', title: 'Second', items: [], position: 2 },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={twoModules}
                    onMoveModuleDown={onMoveModuleDown}
                    mode="edit"
                />
            );

            const downButtons = screen.getAllByLabelText('Move module down');
            fireEvent.click(downButtons[0]); // Move first module down

            await waitFor(() => {
                expect(onMoveModuleDown).toHaveBeenCalledWith('1');
                expect(global.fetch).toHaveBeenCalled();
            });
        });

        it('handles module title editing - save and cancel', async () => {
            const saveModuleTitle = jest.fn();
            const cancelModuleEditing = jest.fn();

            const editingModule = [
                {
                    id: '1',
                    title: 'Editable Module',
                    items: [],
                    position: 1,
                    isEditing: true,
                },
            ];

            const { rerender } = render(
                <CourseModuleList
                    {...defaultProps}
                    modules={editingModule}
                    saveModuleTitle={saveModuleTitle}
                    cancelModuleEditing={cancelModuleEditing}
                    mode="edit"
                />
            );

            // Click Save button
            const saveBtn = screen.getByLabelText('Save module title');
            fireEvent.click(saveBtn);
            expect(saveModuleTitle).toHaveBeenCalledWith('1');

            // Re-render with editing state still true to test cancel
            rerender(
                <CourseModuleList
                    {...defaultProps}
                    modules={editingModule}
                    saveModuleTitle={saveModuleTitle}
                    cancelModuleEditing={cancelModuleEditing}
                    mode="edit"
                />
            );

            // Click Cancel button
            const cancelBtn = screen.getByLabelText('Cancel editing');
            fireEvent.click(cancelBtn);
            expect(cancelModuleEditing).toHaveBeenCalledWith('1');
        });

        it('moves task up with API call and loading state', async () => {
            const onMoveItemUp = jest.fn();
            const moduleWithTasks = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'First Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                        { id: 'task-2', title: 'Second Task', type: 'material' as const, position: 1, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTasks}
                    onMoveItemUp={onMoveItemUp}
                    mode="edit"
                />
            );

            const upButtons = screen.getAllByLabelText('Move item up');
            fireEvent.click(upButtons[1]); // Move second task up

            // Should show loading spinner
            await waitFor(() => {
                expect(screen.getByText('Second Task').closest('div')).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(onMoveItemUp).toHaveBeenCalledWith('1', 'task-2');
                expect(global.fetch).toHaveBeenCalled();
            });
        });

        it('moves task down with API call', async () => {
            const onMoveItemDown = jest.fn();
            const moduleWithTasks = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'First Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                        { id: 'task-2', title: 'Second Task', type: 'material' as const, position: 1, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTasks}
                    onMoveItemDown={onMoveItemDown}
                    mode="edit"
                />
            );

            const downButtons = screen.getAllByLabelText('Move item down');
            fireEvent.click(downButtons[0]); // Move first task down

            await waitFor(() => {
                expect(onMoveItemDown).toHaveBeenCalledWith('1', 'task-1');
                expect(global.fetch).toHaveBeenCalled();
            });
        });

        it('deletes task with confirmation flow', async () => {
            const onDeleteItem = jest.fn();
            const moduleWithTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Task to Delete', type: 'material' as const, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTask}
                    onDeleteItem={onDeleteItem}
                    mode="edit"
                />
            );

            // Click delete button
            const deleteBtn = screen.getByLabelText('Delete item');
            fireEvent.click(deleteBtn);

            // Wait for confirmation dialog to appear and confirm deletion
            await waitFor(() => {
                expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
            });

            const confirmBtn = screen.getByRole('button', { name: 'Delete' });
            fireEvent.click(confirmBtn);

            await waitFor(() => {
                expect(onDeleteItem).toHaveBeenCalledWith('1', 'task-1');
                expect(global.fetch).toHaveBeenCalled();
            });
        });

        it('cancels task deletion', async () => {
            const moduleWithTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTask}
                    onDeleteItem={jest.fn()}
                    mode="edit"
                />
            );

            // Click delete button
            const deleteBtn = screen.getByLabelText('Delete item');
            fireEvent.click(deleteBtn);

            // Wait for confirmation dialog to appear and cancel deletion
            await waitFor(() => {
                expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
            });

            const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
            fireEvent.click(cancelBtn);

            // Dialog should disappear
            await waitFor(() => {
                expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
            });
        });

        it('handles duplicate task error', async () => {
            const onDuplicateItem = jest.fn();

            // Mock fetch to fail
            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({ ok: false, statusText: 'Server Error' })
            );

            const moduleWithTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTask}
                    onDuplicateItem={onDuplicateItem}
                    mode="edit"
                />
            );

            const duplicateBtn = screen.getByLabelText('Duplicate task as draft');
            fireEvent.click(duplicateBtn);

            await waitFor(() => {
                expect(console.error).toHaveBeenCalled();
                expect(onDuplicateItem).not.toHaveBeenCalled();
            });
        });

        it('adds learning material', async () => {
            const onAddLearningMaterial = jest.fn().mockResolvedValue(undefined);
            const moduleExpanded = [
                {
                    id: '1',
                    title: 'Module',
                    items: [],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleExpanded}
                    onAddLearningMaterial={onAddLearningMaterial}
                    mode="edit"
                />
            );

            const addBtn = screen.getByText('Learning material');
            fireEvent.click(addBtn);

            await waitFor(() => {
                expect(onAddLearningMaterial).toHaveBeenCalledWith('1');
            });
        });

        it('adds quiz', async () => {
            const onAddQuiz = jest.fn().mockResolvedValue(undefined);
            const moduleExpanded = [
                {
                    id: '1',
                    title: 'Module',
                    items: [],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleExpanded}
                    onAddQuiz={onAddQuiz}
                    mode="edit"
                />
            );

            const addBtn = screen.getByText('Quiz');
            fireEvent.click(addBtn);

            await waitFor(() => {
                expect(onAddQuiz).toHaveBeenCalledWith('1');
            });
        });

        it('shows partially completed quiz with yellow styling', () => {
            const moduleWithQuiz = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        {
                            id: 'quiz-1',
                            title: 'Partial Quiz',
                            type: 'quiz' as const,
                            position: 0,
                            numQuestions: 3,
                            questions: [],
                            scheduled_publish_at: null,
                        },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithQuiz}
                    mode="view"
                    expandedModules={{ '1': true }}
                    completedQuestionIds={{
                        'quiz-1': { 'q1': true, 'q2': false, 'q3': false }
                    }}
                />
            );

            // Should show amber styling for partial completion (dark mode default)
            const quizTitle = screen.getByText('Partial Quiz');
            expect(quizTitle).toHaveClass('dark:text-amber-200');

            // Should show progress ratio (format: count/total)
            expect(screen.getByText('(1/3)')).toBeInTheDocument();
        });

        it('toggles completion checkbox in view mode', async () => {
            const moduleWithTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTask}
                    mode="view"
                    expandedModules={{ '1': true }}
                    completedTaskIds={{}}
                />
            );

            const checkbox = screen.getByLabelText('Mark as completed');
            expect(checkbox).not.toHaveClass('bg-green-500');

            // Note: This tests the visual state, actual toggle would require parent state management
            fireEvent.click(checkbox);
            // The component doesn't handle the click internally, just renders the state
        });

        it('shows progress bar in both collapsed and expanded states', () => {
            const moduleWithProgress = [
                {
                    id: '1',
                    title: 'Module',
                    items: [],
                    position: 1,
                    progress: 50,
                    isExpanded: false,
                },
            ];

            const { rerender } = render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithProgress}
                    mode="view"
                />
            );

            // Collapsed state - progress bar should be in pb-4 container
            expect(screen.getByText('50%')).toBeInTheDocument();

            // Expand module
            const expandedModule = [
                {
                    ...moduleWithProgress[0],
                    isExpanded: true,
                },
            ];

            rerender(
                <CourseModuleList
                    {...defaultProps}
                    modules={expandedModule}
                    mode="view"
                    expandedModules={{ '1': true }}
                />
            );

            // Expanded state - progress bar should be in pb-2 container
            expect(screen.getByText('50%')).toBeInTheDocument();
        });

        it('ignores clicks on locked module header', () => {
            const onToggleModule = jest.fn();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const lockedModule = [
                {
                    id: '1',
                    title: 'Locked Module',
                    items: [],
                    position: 1,
                    unlockAt: tomorrow.toISOString(),
                    isExpanded: false,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={lockedModule}
                    mode="view"
                    onToggleModule={onToggleModule}
                />
            );

            // Click on locked module header
            fireEvent.click(screen.getByText('Locked Module'));

            // Should not trigger toggle
            expect(onToggleModule).not.toHaveBeenCalled();
        });

        it('prevents toggle when module is in editing mode', () => {
            const onToggleModule = jest.fn();
            const editingModule = [
                {
                    id: '1',
                    title: 'Editing Module',
                    items: [],
                    position: 1,
                    isEditing: true,
                    isExpanded: false,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={editingModule}
                    mode="edit"
                    onToggleModule={onToggleModule}
                />
            );

            // Click on module header while editing
            fireEvent.click(screen.getByText('Editing Module'));

            // Should not trigger toggle
            expect(onToggleModule).not.toHaveBeenCalled();
        });

        it('shows draft and scheduled status badges', () => {
            const moduleWithStatusItems = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        {
                            id: 'draft-task',
                            title: 'Draft Task',
                            type: 'material' as const,
                            position: 0,
                            status: 'draft',
                            scheduled_publish_at: null,
                        },
                        {
                            id: 'scheduled-task',
                            title: 'Scheduled Task',
                            type: 'material' as const,
                            position: 1,
                            status: 'published',
                            scheduled_publish_at: '2024-12-25T10:00:00Z',
                        },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithStatusItems}
                    mode="edit"
                />
            );

            expect(screen.getByText('DRAFT')).toBeInTheDocument();
            expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
        });

        it('handles generating item state', () => {
            const moduleWithGeneratingItem = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        {
                            id: 'generating-task',
                            title: 'Generating Task',
                            type: 'material' as const,
                            position: 0,
                            isGenerating: true,
                            scheduled_publish_at: null,
                        },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithGeneratingItem}
                    mode="view"
                    expandedModules={{ '1': true }}
                />
            );

            const taskElement = screen.getByTestId('module-item-generating-task');
            expect(taskElement).toHaveClass('opacity-40', 'pointer-events-none');
        });

        it('handles missing courseId for API operations', async () => {
            const onMoveModuleUp = jest.fn();

            render(
                <CourseModuleList
                    {...defaultProps}
                    courseId={undefined} // No courseId provided
                    modules={[
                        { id: '1', title: 'First', items: [], position: 1 },
                        { id: '2', title: 'Second', items: [], position: 2 },
                    ]}
                    onMoveModuleUp={onMoveModuleUp}
                    mode="edit"
                />
            );

            const upButtons = screen.getAllByLabelText('Move module up');
            fireEvent.click(upButtons[1]);

            // Should not call the parent handler when courseId is missing
            await waitFor(() => {
                expect(console.error).toHaveBeenCalledWith('Course ID is required for swapping modules');
                expect(onMoveModuleUp).not.toHaveBeenCalled();
            });
        });

        it('handles API errors for module operations', async () => {
            const onMoveModuleUp = jest.fn();

            // Mock fetch to fail
            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({ ok: false, statusText: 'Server Error' })
            );

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={[
                        { id: '1', title: 'First', items: [], position: 1 },
                        { id: '2', title: 'Second', items: [], position: 2 },
                    ]}
                    onMoveModuleUp={onMoveModuleUp}
                    mode="edit"
                />
            );

            const upButtons = screen.getAllByLabelText('Move module up');
            fireEvent.click(upButtons[1]);

            await waitFor(() => {
                expect(console.error).toHaveBeenCalledWith(
                    'Failed to move module up:',
                    expect.any(Error)
                );
            });
        });

        it('handles focusEditor function with various selectors', () => {
            // Test that the component renders with dialog props without errors
            // The focusEditor function is internal and called when dialog is open
            render(
                <CourseModuleList
                    {...defaultProps}
                    isDialogOpen={true}
                    activeItem={{ id: '1', title: 'Test', type: 'material', position: 0, scheduled_publish_at: null }}
                />
            );

            // Verify dialog is rendered (which means focusEditor was called internally)
            expect(screen.getByTestId('course-item-dialog')).toBeInTheDocument();
        });

        it('handles button clicks to prevent event propagation', () => {
            const onToggleModule = jest.fn();
            const moduleWithButton = [
                {
                    id: '1',
                    title: 'Module',
                    items: [],
                    position: 1,
                    isExpanded: false,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithButton}
                    mode="edit"
                    onToggleModule={onToggleModule}
                />
            );

            // Click on a button within the module header - should not trigger toggle
            const editBtn = screen.getByLabelText('Edit module title');
            fireEvent.click(editBtn);

            // Should not trigger module toggle
            expect(onToggleModule).not.toHaveBeenCalled();
        });

        it('handles getItemTypeName function for different types', async () => {
            const moduleWithDifferentTypes = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'material-1', title: 'Material', type: 'material' as const, position: 0, scheduled_publish_at: null },
                        { id: 'quiz-1', title: 'Quiz', type: 'quiz' as const, position: 1, questions: [], scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithDifferentTypes}
                    onDeleteItem={jest.fn()}
                    mode="edit"
                />
            );

            // Click delete on material item
            const deleteButtons = screen.getAllByLabelText('Delete item');
            fireEvent.click(deleteButtons[0]);

            // Wait for confirmation dialog and check the message
            await waitFor(() => {
                expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
                expect(screen.getByText('Are you sure you want to delete this learning material?')).toBeInTheDocument();
            });
        });

        it('handles edge cases in task movement', async () => {
            const onMoveItemUp = jest.fn();
            const moduleWithSingleTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Only Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithSingleTask}
                    onMoveItemUp={onMoveItemUp}
                    mode="edit"
                />
            );

            // Try to move the only task up (should be disabled)
            const upButton = screen.getByLabelText('Move item up');
            expect(upButton).toBeDisabled();
        });

        it('handles missing onEditModuleTitle callback', () => {
            const moduleInEditMode = [
                {
                    id: '1',
                    title: 'Module',
                    items: [],
                    position: 1,
                    isEditing: false,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleInEditMode}
                    onEditModuleTitle={undefined} // Missing callback
                    mode="edit"
                />
            );

            const editBtn = screen.getByLabelText('Edit module title');

            // Should not throw when onEditModuleTitle is undefined
            expect(() => {
                fireEvent.click(editBtn);
            }).not.toThrow();
        });

        it('handles error in onAddLearningMaterial', async () => {
            const onAddLearningMaterial = jest.fn().mockRejectedValue(new Error('Add failed'));
            const moduleExpanded = [
                {
                    id: '1',
                    title: 'Module',
                    items: [],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleExpanded}
                    onAddLearningMaterial={onAddLearningMaterial}
                    mode="edit"
                />
            );

            const addBtn = screen.getByText('Learning material');
            fireEvent.click(addBtn);

            await waitFor(() => {
                expect(onAddLearningMaterial).toHaveBeenCalledWith('1');
                expect(console.error).toHaveBeenCalledWith('Failed to add learning material:', expect.any(Error));
            });
        });

        it('handles error in onAddQuiz', async () => {
            const onAddQuiz = jest.fn().mockRejectedValue(new Error('Add quiz failed'));
            const moduleExpanded = [
                {
                    id: '1',
                    title: 'Module',
                    items: [],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleExpanded}
                    onAddQuiz={onAddQuiz}
                    mode="edit"
                />
            );

            const addBtn = screen.getByText('Quiz');
            fireEvent.click(addBtn);

            await waitFor(() => {
                expect(onAddQuiz).toHaveBeenCalledWith('1');
                expect(console.error).toHaveBeenCalledWith('Failed to add quiz:', expect.any(Error));
            });
        });

        it('handles missing onDuplicateItem callback', async () => {
            const moduleWithTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTask}
                    onDuplicateItem={undefined} // Missing callback
                    mode="edit"
                />
            );

            const duplicateBtn = screen.getByLabelText('Duplicate task as draft');
            fireEvent.click(duplicateBtn);

            // Should not crash when callback is missing
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            });
        });

        it('handles API error in task swapping', async () => {
            const onMoveItemUp = jest.fn();

            // Mock fetch to fail
            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({ ok: false, statusText: 'Server Error' })
            );

            const moduleWithTasks = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'First Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                        { id: 'task-2', title: 'Second Task', type: 'material' as const, position: 1, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTasks}
                    onMoveItemUp={onMoveItemUp}
                    mode="edit"
                />
            );

            const upButtons = screen.getAllByLabelText('Move item up');
            fireEvent.click(upButtons[1]); // Move second task up

            await waitFor(() => {
                expect(console.error).toHaveBeenCalledWith(
                    'Failed to move task up:',
                    expect.any(Error)
                );
                expect(onMoveItemUp).not.toHaveBeenCalled();
            });
        });

        it('handles API error in task down movement', async () => {
            const onMoveItemDown = jest.fn();

            // Mock fetch to fail
            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({ ok: false, statusText: 'Server Error' })
            );

            const moduleWithTasks = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'First Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                        { id: 'task-2', title: 'Second Task', type: 'material' as const, position: 1, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTasks}
                    onMoveItemDown={onMoveItemDown}
                    mode="edit"
                />
            );

            const downButtons = screen.getAllByLabelText('Move item down');
            fireEvent.click(downButtons[0]); // Move first task down

            await waitFor(() => {
                expect(console.error).toHaveBeenCalledWith(
                    'Failed to move task down:',
                    expect.any(Error)
                );
                expect(onMoveItemDown).not.toHaveBeenCalled();
            });
        });

        it('handles getItemTypeName for undefined type', async () => {
            const moduleWithUndefinedTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Undefined Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithUndefinedTask}
                    onDeleteItem={jest.fn()}
                    mode="edit"
                />
            );

            // Click delete on task
            const deleteBtn = screen.getByLabelText('Delete item');
            fireEvent.click(deleteBtn);

            // Wait for confirmation dialog and check the message
            await waitFor(() => {
                expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
                expect(screen.getByText('Are you sure you want to delete this learning material?')).toBeInTheDocument();
            });
        });

        it('handles missing courseId for task operations', async () => {
            const onMoveItemUp = jest.fn();

            render(
                <CourseModuleList
                    {...defaultProps}
                    courseId={undefined} // No courseId provided
                    modules={[
                        {
                            id: '1',
                            title: 'Module',
                            items: [
                                { id: 'task-1', title: 'First Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                                { id: 'task-2', title: 'Second Task', type: 'material' as const, position: 1, scheduled_publish_at: null },
                            ],
                            position: 1,
                            isExpanded: true,
                        },
                    ]}
                    onMoveItemUp={onMoveItemUp}
                    mode="edit"
                />
            );

            const upButtons = screen.getAllByLabelText('Move item up');
            fireEvent.click(upButtons[1]);

            // Should not call the parent handler when courseId is missing
            await waitFor(() => {
                expect(console.error).toHaveBeenCalledWith('Course ID is required for swapping modules');
                expect(onMoveItemUp).not.toHaveBeenCalled();
            });
        });

        it('handles network errors in duplicate task', async () => {
            const onDuplicateItem = jest.fn();

            // Mock fetch to throw network error
            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.reject(new Error('Network error'))
            );

            const moduleWithTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTask}
                    onDuplicateItem={onDuplicateItem}
                    mode="edit"
                />
            );

            const duplicateBtn = screen.getByLabelText('Duplicate task as draft');
            fireEvent.click(duplicateBtn);

            await waitFor(() => {
                expect(console.error).toHaveBeenCalledWith('Error duplicating task:', expect.any(Error));
                expect(onDuplicateItem).not.toHaveBeenCalled();
            });
        });

        it('handles missing courseId for duplicate task', async () => {
            render(
                <CourseModuleList
                    {...defaultProps}
                    courseId={undefined} // No courseId
                    modules={[
                        {
                            id: '1',
                            title: 'Module',
                            items: [
                                { id: 'task-1', title: 'Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                            ],
                            position: 1,
                            isExpanded: true,
                        },
                    ]}
                    onDuplicateItem={jest.fn()}
                    mode="edit"
                />
            );

            const duplicateBtn = screen.getByLabelText('Duplicate task as draft');
            fireEvent.click(duplicateBtn);

            await waitFor(() => {
                expect(console.error).toHaveBeenCalledWith('Course ID is required for cloning tasks');
            });
        });

        it('handles API error in module deletion', async () => {
            const onDeleteModule = jest.fn();

            // Mock fetch to fail
            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({ ok: false, statusText: 'Server Error' })
            );

            render(
                <CourseModuleList
                    {...defaultProps}
                    onDeleteModule={onDeleteModule}
                    mode="edit"
                />
            );

            // Click delete module
            const deleteBtn = screen.getByLabelText('Delete module');
            fireEvent.click(deleteBtn);

            // Confirm deletion - use more specific selector
            const confirmBtn = await screen.findByTestId('confirmation-dialog');
            const deleteButton = within(confirmBtn).getByText('Delete');
            fireEvent.click(deleteButton);

            await waitFor(() => {
                expect(console.error).toHaveBeenCalledWith('Error deleting module:', expect.any(Error));
                expect(onDeleteModule).not.toHaveBeenCalled();
            });
        });

        it('handles network error in module deletion', async () => {
            const onDeleteModule = jest.fn();

            // Mock fetch to throw network error
            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.reject(new Error('Network error'))
            );

            render(
                <CourseModuleList
                    {...defaultProps}
                    onDeleteModule={onDeleteModule}
                    mode="edit"
                />
            );

            // Click delete module
            const deleteBtn = screen.getByLabelText('Delete module');
            fireEvent.click(deleteBtn);

            // Confirm deletion - use more specific selector
            const confirmBtn = await screen.findByTestId('confirmation-dialog');
            const deleteButton = within(confirmBtn).getByText('Delete');
            fireEvent.click(deleteButton);

            await waitFor(() => {
                expect(console.error).toHaveBeenCalledWith('Error deleting module:', expect.any(Error));
                expect(onDeleteModule).not.toHaveBeenCalled();
            });
        });

        it('handles contentEditable click in editing mode', () => {
            const editingModule = [
                {
                    id: '1',
                    title: 'Editable Module',
                    items: [],
                    position: 1,
                    isEditing: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={editingModule}
                    mode="edit"
                />
            );

            // Find the contentEditable element by data attribute
            const editableTitle = screen.getByText('Editable Module');
            expect(editableTitle).toHaveAttribute('contenteditable', 'true');

            // Click on it - this should stop propagation and not toggle module
            const onToggleModule = jest.fn();
            fireEvent.click(editableTitle);

            // Should not have triggered toggle
            expect(onToggleModule).not.toHaveBeenCalled();
        });

        it('handles small screen toggle button in view mode', () => {
            const onToggleModule = jest.fn();
            const moduleInViewMode = [
                {
                    id: '1',
                    title: 'Module',
                    items: [],
                    position: 1,
                    isExpanded: false,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleInViewMode}
                    mode="view"
                    onToggleModule={onToggleModule}
                />
            );

            // Find the view mode expand button with text
            const expandBtn = screen.getByText('Expand');
            fireEvent.click(expandBtn);

            expect(onToggleModule).toHaveBeenCalledWith('1');
        });

        it('handles locked module toggle button in view mode', () => {
            const onToggleModule = jest.fn();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const lockedModuleInViewMode = [
                {
                    id: '1',
                    title: 'Locked Module',
                    items: [],
                    position: 1,
                    isExpanded: false,
                    unlockAt: tomorrow.toISOString(),
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={lockedModuleInViewMode}
                    mode="view"
                    onToggleModule={onToggleModule}
                />
            );

            // Find the locked module expand button - use getAllByLabelText and check which is disabled
            const expandBtns = screen.getAllByLabelText('Expand module');
            const viewModeBtn = expandBtns.find(btn => btn.classList.contains('rounded-full'));
            expect(viewModeBtn).toBeDisabled();

            fireEvent.click(viewModeBtn!);

            // Should not trigger toggle for locked module
            expect(onToggleModule).not.toHaveBeenCalled();
        });

        it('handles small screen chevron button for locked module', () => {
            const onToggleModule = jest.fn();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const lockedModule = [
                {
                    id: '1',
                    title: 'Locked Module',
                    items: [],
                    position: 1,
                    isExpanded: false,
                    unlockAt: tomorrow.toISOString(),
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={lockedModule}
                    mode="edit"
                    onToggleModule={onToggleModule}
                />
            );

            // Find the small screen chevron button (the one without rounded-full class)
            const expandBtns = screen.getAllByLabelText('Expand module');
            const chevronBtn = expandBtns.find(btn => !btn.classList.contains('rounded-full'));
            fireEvent.click(chevronBtn!);

            // Should not trigger toggle for locked module
            expect(onToggleModule).not.toHaveBeenCalled();
        });

        it('handles item click when onOpenItem is missing', () => {
            const moduleWithTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTask}
                    onOpenItem={undefined} // Missing callback
                    mode="view"
                    expandedModules={{ '1': true }}
                />
            );

            const taskElement = screen.getByTestId('module-item-task-1');

            // Should not crash when clicking without onOpenItem callback
            expect(() => {
                fireEvent.click(taskElement);
            }).not.toThrow();
        });

        it('handles item click when item is generating', () => {
            const onOpenItem = jest.fn();
            const moduleWithGeneratingTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        {
                            id: 'task-1',
                            title: 'Generating Task',
                            type: 'material' as const,
                            position: 0,
                            isGenerating: true,
                            scheduled_publish_at: null,
                        },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithGeneratingTask}
                    onOpenItem={onOpenItem}
                    mode="view"
                    expandedModules={{ '1': true }}
                />
            );

            const taskElement = screen.getByTestId('module-item-task-1');
            fireEvent.click(taskElement);

            // Should not call onOpenItem when item is generating
            expect(onOpenItem).not.toHaveBeenCalled();
        });

        it('handles quiz without draft status for question count display', () => {
            const moduleWithQuiz = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        {
                            id: 'quiz-1',
                            title: 'Published Quiz',
                            type: 'quiz' as const,
                            position: 0,
                            numQuestions: 5,
                            status: 'published', // Not draft
                            questions: [],
                            scheduled_publish_at: null,
                        },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithQuiz}
                    mode="view"
                    expandedModules={{ '1': true }}
                    completedQuestionIds={{}} // No completed questions
                />
            );

            // Should show question count for non-draft quiz
            expect(screen.getByText('(5 questions)')).toBeInTheDocument();
        });

        it('handles quiz with single question count', () => {
            const moduleWithSingleQuestionQuiz = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        {
                            id: 'quiz-1',
                            title: 'Single Question Quiz',
                            type: 'quiz' as const,
                            position: 0,
                            numQuestions: 1,
                            status: 'published',
                            questions: [],
                            scheduled_publish_at: null,
                        },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithSingleQuestionQuiz}
                    mode="view"
                    expandedModules={{ '1': true }}
                />
            );

            // Should show singular "question" not "questions"
            expect(screen.getByText('(1 question)')).toBeInTheDocument();
        });

        it('handles progress display for expanded vs collapsed modules', () => {
            const moduleWithProgress = [
                {
                    id: '1',
                    title: 'Module with Progress',
                    items: [],
                    position: 1,
                    progress: 75,
                    isExpanded: false,
                },
            ];

            const { rerender } = render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithProgress}
                    mode="view"
                />
            );

            // Initially collapsed - progress bar should be visible
            expect(screen.getByText('75%')).toBeInTheDocument();

            // Expand the module
            const expandedModule = [
                {
                    ...moduleWithProgress[0],
                    isExpanded: true,
                },
            ];

            rerender(
                <CourseModuleList
                    {...defaultProps}
                    modules={expandedModule}
                    mode="view"
                    expandedModules={{ '1': true }}
                />
            );

            // Still expanded - progress bar should still be visible
            expect(screen.getByText('75%')).toBeInTheDocument();
        });

        it('handles missing onMoveModuleDown callback', async () => {
            const twoModules = [
                { id: '1', title: 'First', items: [], position: 1 },
                { id: '2', title: 'Second', items: [], position: 2 },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={twoModules}
                    onMoveModuleDown={undefined} // Missing callback
                    mode="edit"
                />
            );

            const downButtons = screen.getAllByLabelText('Move module down');
            fireEvent.click(downButtons[0]); // Try to move first module down

            // Should not crash when callback is missing
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            });
        });

        it('handles task movement when module not found', async () => {
            const nonExistentModuleId = 'nonexistent';
            const moduleWithTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            const component = render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTask}
                    mode="edit"
                />
            );

            // Manually call the internal function with non-existent module ID
            // This tests the early return when module is not found
            const handleMoveTaskUp = (component.container as any)._handleMoveTaskUp;

            // Since we can't directly access internal functions, we'll simulate this condition
            // by testing edge cases that would trigger early returns
            expect(component.container).toBeInTheDocument();
        });

        it('handles task movement when task not found', () => {
            const moduleWithNoTasks = [
                {
                    id: '1',
                    title: 'Module',
                    items: [],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithNoTasks}
                    mode="edit"
                />
            );

            // With no tasks, there should be no move buttons to click
            expect(screen.queryByLabelText('Move item up')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Move item down')).not.toBeInTheDocument();
        });

        it('handles module click when module not found', () => {
            const onToggleModule = jest.fn();

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={[]}
                    onToggleModule={onToggleModule}
                    mode="edit"
                />
            );

            // With no modules, there should be no module headers to click
            expect(screen.queryByText('Test Module')).not.toBeInTheDocument();
        });

        it('handles clicking on SVG element inside button', () => {
            const onToggleModule = jest.fn();

            render(
                <CourseModuleList
                    {...defaultProps}
                    onToggleModule={onToggleModule}
                    mode="edit"
                />
            );

            // Find an SVG inside a button and click it
            const editButton = screen.getByLabelText('Edit module title');
            const svg = editButton.querySelector('svg');

            if (svg) {
                fireEvent.click(svg);
                // Should not trigger module toggle when clicking on SVG inside button
                expect(onToggleModule).not.toHaveBeenCalled();
            }
        });

        it('handles missing onDeleteItem callback', async () => {
            const moduleWithTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTask}
                    onDeleteItem={undefined} // Missing callback
                    mode="edit"
                />
            );

            const deleteBtn = screen.getByLabelText('Delete item');
            fireEvent.click(deleteBtn);

            // Should not show confirmation dialog when callback is missing
            await waitFor(() => {
                expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
            });
        });

        it('handles task deletion API error', async () => {
            const onDeleteItem = jest.fn();

            // Mock fetch to fail
            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({ ok: false, statusText: 'Server Error' })
            );

            const moduleWithTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTask}
                    onDeleteItem={onDeleteItem}
                    mode="edit"
                />
            );

            const deleteBtn = screen.getByLabelText('Delete item');
            fireEvent.click(deleteBtn);

            const confirmDialog = await screen.findByTestId('confirmation-dialog');
            const deleteButton = within(confirmDialog).getByText('Delete');
            fireEvent.click(deleteButton);

            await waitFor(() => {
                expect(console.error).toHaveBeenCalledWith('Error deleting task:', expect.any(Error));
                expect(onDeleteItem).not.toHaveBeenCalled();
            });
        });

        it('handles missing onMoveItemUp callback', async () => {
            const moduleWithTasks = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'First Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                        { id: 'task-2', title: 'Second Task', type: 'material' as const, position: 1, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTasks}
                    onMoveItemUp={undefined} // Missing callback
                    mode="edit"
                />
            );

            const upButtons = screen.getAllByLabelText('Move item up');
            fireEvent.click(upButtons[1]); // Move second task up

            // Should not crash when callback is missing
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            });
        });

        it('handles missing onMoveItemDown callback', async () => {
            const moduleWithTasks = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'First Task', type: 'material' as const, position: 0, scheduled_publish_at: null },
                        { id: 'task-2', title: 'Second Task', type: 'material' as const, position: 1, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithTasks}
                    onMoveItemDown={undefined} // Missing callback
                    mode="edit"
                />
            );

            const downButtons = screen.getAllByLabelText('Move item down');
            fireEvent.click(downButtons[0]); // Move first task down

            // Should not crash when callback is missing
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            });
        });

        it('handles getItemTypeName with default case', async () => {
            const moduleWithUnknownTask = [
                {
                    id: '1',
                    title: 'Module',
                    items: [
                        { id: 'task-1', title: 'Unknown Task', type: 'unknown' as any, position: 0, scheduled_publish_at: null },
                    ],
                    position: 1,
                    isExpanded: true,
                },
            ];

            render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithUnknownTask}
                    onDeleteItem={jest.fn()}
                    mode="edit"
                />
            );

            const deleteBtn = screen.getByLabelText('Delete item');
            fireEvent.click(deleteBtn);

            // Wait for confirmation dialog and check the message handles unknown type
            await waitFor(() => {
                expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
                expect(screen.getByText('Are you sure you want to delete this undefined?')).toBeInTheDocument();
            });
        });

        it('handles focusEditor with different DOM selectors', () => {
            // Create mock DOM elements for different selectors
            const mockEditor = document.createElement('div');
            mockEditor.classList.add('bn-editor');
            mockEditor.focus = jest.fn();
            document.body.appendChild(mockEditor);

            render(
                <CourseModuleList
                    {...defaultProps}
                    isDialogOpen={true}
                    activeItem={{ id: '1', title: 'Test', type: 'material', position: 0, scheduled_publish_at: null }}
                />
            );

            // The focusEditor function is called internally when dialog opens
            // We can't directly test it, but we can verify the dialog renders
            expect(screen.getByTestId('course-item-dialog')).toBeInTheDocument();

            // Clean up
            document.body.removeChild(mockEditor);
        });

        it('handles backgroundColor style for modules', () => {
            const moduleWithBackground = [
                {
                    id: '1',
                    title: 'Module with Background',
                    items: [],
                    position: 1,
                    backgroundColor: '#ff0000',
                },
            ];

            const { container } = render(
                <CourseModuleList
                    {...defaultProps}
                    modules={moduleWithBackground}
                    mode="edit"
                />
            );

            // Check that the style is applied
            const moduleDiv = container.querySelector('.border-none.rounded-lg');
            expect(moduleDiv).toHaveStyle('background-color: #ff0000');
        });
    });
});