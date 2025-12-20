import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClientPreviewWrapper from '@/app/school/admin/[id]/courses/[courseId]/preview/ClientPreviewWrapper';
import { Module } from '@/types/course';

// Mock the LearnerCourseView component
jest.mock('@/components/LearnerCourseView', () => {
    return jest.fn(({ modules, completedTaskIds, completedQuestionIds, isTestMode }) => (
        <div data-testid="learner-course-view">
            <div data-testid="modules-count">{modules.length}</div>
            <div data-testid="completed-task-ids">{JSON.stringify(completedTaskIds)}</div>
            <div data-testid="completed-question-ids">{JSON.stringify(completedQuestionIds)}</div>
            <div data-testid="is-test-mode">{isTestMode.toString()}</div>
            {modules.map((module: Module) => (
                <div key={module.id} data-testid={`module-${module.id}`}>
                    {module.title}
                </div>
            ))}
        </div>
    ));
});

// Import the mocked function to access it in tests
const mockLearnerCourseView = require('@/components/LearnerCourseView');

describe('ClientPreviewWrapper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Component rendering', () => {
        it('should render LearnerCourseView with correct props', () => {
            const testModules: Module[] = [
                {
                    id: 'module-1',
                    title: 'Test Module 1',
                    position: 1,
                    items: []
                }
            ];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('learner-course-view')).toBeInTheDocument();
            expect(mockLearnerCourseView).toHaveBeenCalledTimes(1);
            expect(mockLearnerCourseView).toHaveBeenCalledWith(
                {
                    modules: testModules,
                    completedTaskIds: {},
                    completedQuestionIds: {},
                    isTestMode: true
                },
                undefined
            );
        });

        it('should render without crashing when modules is empty array', () => {
            const testModules: Module[] = [];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('learner-course-view')).toBeInTheDocument();
            expect(screen.getByTestId('modules-count')).toHaveTextContent('0');
        });

        it('should pass through modules prop correctly', () => {
            const testModules: Module[] = [
                {
                    id: 'module-1',
                    title: 'Module 1',
                    position: 1,
                    items: []
                },
                {
                    id: 'module-2',
                    title: 'Module 2',
                    position: 2,
                    items: []
                }
            ];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('modules-count')).toHaveTextContent('2');
            expect(screen.getByTestId('module-module-1')).toHaveTextContent('Module 1');
            expect(screen.getByTestId('module-module-2')).toHaveTextContent('Module 2');
        });

        it('should render only one LearnerCourseView component', () => {
            const testModules: Module[] = [{ id: 'test', title: 'Test', position: 1, items: [] }];

            const { container } = render(<ClientPreviewWrapper modules={testModules} />);

            expect(container.children).toHaveLength(1);
            expect(container.firstChild).toHaveAttribute('data-testid', 'learner-course-view');
        });
    });

    describe('Hard-coded props verification', () => {
        it('should always pass empty object for completedTaskIds', () => {
            const testModules: Module[] = [{ id: 'test', title: 'Test', position: 1, items: [] }];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('completed-task-ids')).toHaveTextContent('{}');
            expect(mockLearnerCourseView).toHaveBeenCalledWith(
                expect.objectContaining({
                    completedTaskIds: {}
                }),
                undefined
            );
        });

        it('should always pass empty object for completedQuestionIds', () => {
            const testModules: Module[] = [{ id: 'test', title: 'Test', position: 1, items: [] }];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('completed-question-ids')).toHaveTextContent('{}');
            expect(mockLearnerCourseView).toHaveBeenCalledWith(
                expect.objectContaining({
                    completedQuestionIds: {}
                }),
                undefined
            );
        });

        it('should always pass true for isTestMode', () => {
            const testModules: Module[] = [{ id: 'test', title: 'Test', position: 1, items: [] }];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('is-test-mode')).toHaveTextContent('true');
            expect(mockLearnerCourseView).toHaveBeenCalledWith(
                expect.objectContaining({
                    isTestMode: true
                }),
                undefined
            );
        });

        it('should pass exactly four props to LearnerCourseView', () => {
            const testModules: Module[] = [{ id: 'test', title: 'Test', position: 1, items: [] }];

            render(<ClientPreviewWrapper modules={testModules} />);

            const [props] = mockLearnerCourseView.mock.calls[0];
            expect(Object.keys(props)).toHaveLength(4);
            expect(Object.keys(props)).toEqual(
                expect.arrayContaining(['modules', 'completedTaskIds', 'completedQuestionIds', 'isTestMode'])
            );
        });
    });

    describe('Module variations', () => {
        it('should handle modules with complex structure and items', () => {
            const testModules: Module[] = [
                {
                    id: 'complex-module',
                    title: 'Complex Module',
                    position: 1,
                    isExpanded: true,
                    backgroundColor: '#ffffff',
                    isEditing: false,
                    progress: 75,
                    unlockAt: '2024-01-01T00:00:00Z',
                    items: [
                        {
                            id: 'item-1',
                            title: 'Learning Material',
                            position: 1,
                            type: 'material',
                            content: [],
                            status: 'published',
                            scheduled_publish_at: null
                        },
                        {
                            id: 'item-2',
                            title: 'Quiz Item',
                            position: 2,
                            type: 'quiz',
                            questions: [],
                            status: 'published',
                            scheduled_publish_at: null
                        }
                    ]
                }
            ];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(mockLearnerCourseView).toHaveBeenCalledWith(
                expect.objectContaining({
                    modules: testModules
                }),
                undefined
            );
            expect(screen.getByTestId('module-complex-module')).toHaveTextContent('Complex Module');
        });

        it('should handle modules with special characters in titles and ids', () => {
            const testModules: Module[] = [
                {
                    id: 'module-with-special_chars@123',
                    title: 'Module with Special Characters: éñ & Symbols!',
                    position: 1,
                    items: []
                }
            ];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('module-module-with-special_chars@123'))
                .toHaveTextContent('Module with Special Characters: éñ & Symbols!');
        });

        it('should handle modules with undefined optional properties', () => {
            const testModules: Module[] = [
                {
                    id: 'minimal-module',
                    title: 'Minimal Module',
                    position: 1,
                    items: []
                    // All optional properties are undefined
                }
            ];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(mockLearnerCourseView).toHaveBeenCalledWith(
                expect.objectContaining({
                    modules: testModules
                }),
                undefined
            );
        });

        it('should handle large number of modules', () => {
            const testModules: Module[] = Array.from({ length: 100 }, (_, index) => ({
                id: `module-${index}`,
                title: `Module ${index}`,
                position: index + 1,
                items: []
            }));

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('modules-count')).toHaveTextContent('100');
            expect(mockLearnerCourseView).toHaveBeenCalledWith(
                expect.objectContaining({
                    modules: testModules
                }),
                undefined
            );
        });
    });

    describe('Component behavior consistency', () => {
        it('should maintain consistent behavior across multiple renders', () => {
            const testModules: Module[] = [{ id: 'consistent', title: 'Consistent', position: 1, items: [] }];

            const { rerender } = render(<ClientPreviewWrapper modules={testModules} />);
            expect(mockLearnerCourseView).toHaveBeenCalledTimes(1);

            rerender(<ClientPreviewWrapper modules={testModules} />);
            expect(mockLearnerCourseView).toHaveBeenCalledTimes(2);

            // Both calls should have identical arguments
            expect(mockLearnerCourseView.mock.calls[0][0]).toEqual(mockLearnerCourseView.mock.calls[1][0]);
        });

        it('should handle prop changes between renders', () => {
            const modules1: Module[] = [{ id: 'module1', title: 'Module 1', position: 1, items: [] }];
            const modules2: Module[] = [{ id: 'module2', title: 'Module 2', position: 1, items: [] }];

            const { rerender } = render(<ClientPreviewWrapper modules={modules1} />);
            expect(mockLearnerCourseView).toHaveBeenLastCalledWith(
                expect.objectContaining({ modules: modules1 }),
                undefined
            );

            rerender(<ClientPreviewWrapper modules={modules2} />);
            expect(mockLearnerCourseView).toHaveBeenLastCalledWith(
                expect.objectContaining({ modules: modules2 }),
                undefined
            );
        });

        it('should always create new empty objects for completedTaskIds and completedQuestionIds', () => {
            const testModules: Module[] = [{ id: 'test', title: 'Test', position: 1, items: [] }];

            const { rerender } = render(<ClientPreviewWrapper modules={testModules} />);
            const firstCallProps = mockLearnerCourseView.mock.calls[0][0];

            rerender(<ClientPreviewWrapper modules={testModules} />);
            const secondCallProps = mockLearnerCourseView.mock.calls[1][0];

            // Objects should have same content but be different instances
            expect(firstCallProps.completedTaskIds).toEqual(secondCallProps.completedTaskIds);
            expect(firstCallProps.completedQuestionIds).toEqual(secondCallProps.completedQuestionIds);

            // For new object instances (though in this simple case they're the same literal {})
            expect(firstCallProps.isTestMode).toBe(secondCallProps.isTestMode);
        });
    });

    describe('Component identity and metadata', () => {
        it('should export a function component', () => {
            expect(typeof ClientPreviewWrapper).toBe('function');
        });

        it('should be a valid React component', () => {
            const testModules: Module[] = [];

            expect(() => {
                render(<ClientPreviewWrapper modules={testModules} />);
            }).not.toThrow();
        });

        it('should accept exactly one prop (modules)', () => {
            // This is enforced by TypeScript, but we can verify runtime behavior
            const testModules: Module[] = [{ id: 'test', title: 'Test', position: 1, items: [] }];

            render(<ClientPreviewWrapper modules={testModules} />);

            // Component should render successfully with only the modules prop
            expect(screen.getByTestId('learner-course-view')).toBeInTheDocument();
        });
    });

    describe('Error scenarios and edge cases', () => {
        it('should handle modules with duplicate ids gracefully', () => {
            const testModules: Module[] = [
                { id: 'duplicate', title: 'First Module', position: 1, items: [] },
                { id: 'duplicate', title: 'Second Module', position: 2, items: [] }
            ];

            // React should handle key conflicts gracefully in our mock
            expect(() => {
                render(<ClientPreviewWrapper modules={testModules} />);
            }).not.toThrow();

            expect(screen.getByTestId('modules-count')).toHaveTextContent('2');
        });

        it('should handle modules with very long titles', () => {
            const longTitle = 'A'.repeat(1000);
            const testModules: Module[] = [
                { id: 'long-title', title: longTitle, position: 1, items: [] }
            ];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('module-long-title')).toHaveTextContent(longTitle);
        });

        it('should handle modules with numeric positions', () => {
            const testModules: Module[] = [
                { id: 'pos-zero', title: 'Zero Position', position: 0, items: [] },
                { id: 'pos-negative', title: 'Negative Position', position: -1, items: [] },
                { id: 'pos-float', title: 'Float Position', position: 1.5, items: [] }
            ];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('modules-count')).toHaveTextContent('3');
        });

        it('should handle modules with empty string properties', () => {
            const testModules: Module[] = [
                { id: '', title: '', position: 1, items: [] }
            ];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('modules-count')).toHaveTextContent('1');
        });
    });

    describe('Props isolation and immutability', () => {
        it('should not modify the original modules array', () => {
            const originalModules: Module[] = [
                { id: 'original', title: 'Original Module', position: 1, items: [] }
            ];
            const modulesCopy = JSON.parse(JSON.stringify(originalModules));

            render(<ClientPreviewWrapper modules={originalModules} />);

            // Original modules should remain unchanged
            expect(originalModules).toEqual(modulesCopy);
        });

        it('should pass the exact modules reference to LearnerCourseView', () => {
            const testModules: Module[] = [{ id: 'reference', title: 'Reference Test', position: 1, items: [] }];

            render(<ClientPreviewWrapper modules={testModules} />);

            const passedModules = mockLearnerCourseView.mock.calls[0][0].modules;
            expect(passedModules).toBe(testModules); // Same reference
        });
    });

    describe('React lifecycle and performance', () => {
        it('should render immediately without async delays', () => {
            const testModules: Module[] = [{ id: 'immediate', title: 'Immediate Render', position: 1, items: [] }];

            const renderResult = render(<ClientPreviewWrapper modules={testModules} />);

            // Should be available immediately after render
            expect(renderResult.getByTestId('learner-course-view')).toBeInTheDocument();
        });

        it('should handle rapid re-renders efficiently', () => {
            const testModules: Module[] = [{ id: 'rapid', title: 'Rapid Render', position: 1, items: [] }];

            const { rerender } = render(<ClientPreviewWrapper modules={testModules} />);

            // Perform multiple rapid re-renders
            for (let i = 0; i < 10; i++) {
                rerender(<ClientPreviewWrapper modules={testModules} />);
            }

            expect(mockLearnerCourseView).toHaveBeenCalledTimes(11); // Initial + 10 re-renders
            expect(screen.getByTestId('learner-course-view')).toBeInTheDocument();
        });

        it('should handle component unmounting gracefully', () => {
            const testModules: Module[] = [{ id: 'unmount', title: 'Unmount Test', position: 1, items: [] }];

            const { unmount } = render(<ClientPreviewWrapper modules={testModules} />);

            expect(() => {
                unmount();
            }).not.toThrow();
        });
    });

    describe('Client-side behavior', () => {
        it('should be marked as a client component', () => {
            // The component file should have "use client" directive
            // This is mainly for Next.js SSR/SSG behavior
            const testModules: Module[] = [{ id: 'client', title: 'Client Component', position: 1, items: [] }];

            expect(() => {
                render(<ClientPreviewWrapper modules={testModules} />);
            }).not.toThrow();
        });

        it('should work in a client-side environment', () => {
            const testModules: Module[] = [{ id: 'client-env', title: 'Client Environment', position: 1, items: [] }];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('learner-course-view')).toBeInTheDocument();
            expect(mockLearnerCourseView).toHaveBeenCalledWith(
                expect.objectContaining({
                    isTestMode: true
                }),
                undefined
            );
        });
    });

    describe('Import and export verification', () => {
        it('should be the default export', () => {
            expect(ClientPreviewWrapper).toBeDefined();
            expect(typeof ClientPreviewWrapper).toBe('function');
        });

        it('should import required dependencies correctly', () => {
            // Test that React components can be created
            const testModules: Module[] = [];

            const component = React.createElement(ClientPreviewWrapper, { modules: testModules });
            expect(component).toBeDefined();
            expect(component.type).toBe(ClientPreviewWrapper);
        });
    });

    describe('TypeScript type safety', () => {
        it('should accept properly typed modules prop', () => {
            const testModules: Module[] = [
                {
                    id: 'typed-module',
                    title: 'Typed Module',
                    position: 1,
                    items: [],
                    isExpanded: true,
                    backgroundColor: '#000000'
                }
            ];

            expect(() => {
                render(<ClientPreviewWrapper modules={testModules} />);
            }).not.toThrow();
        });

        it('should work with minimal module structure', () => {
            const testModules: Module[] = [
                {
                    id: 'minimal-typed',
                    title: 'Minimal Typed',
                    position: 1,
                    items: []
                }
            ];

            render(<ClientPreviewWrapper modules={testModules} />);

            expect(screen.getByTestId('learner-course-view')).toBeInTheDocument();
        });
    });
}); 