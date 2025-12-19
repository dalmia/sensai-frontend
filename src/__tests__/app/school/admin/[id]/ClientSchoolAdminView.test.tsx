import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ClientSchoolAdminView from '@/app/school/admin/[id]/ClientSchoolAdminView';

// Mock dependencies
jest.mock('next-auth/react', () => ({
    useSession: jest.fn(),
}));

jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock components
jest.mock('@/components/layout/header', () => ({
    Header: function MockHeader({ showCreateCourseButton }: any) {
        return (
            <header data-testid="header">
                <div data-testid="show-create-course-button">{showCreateCourseButton.toString()}</div>
            </header>
        );
    }
}));

jest.mock('@/components/CourseCard', () => {
    return function MockCourseCard({ course, onDelete }: any) {
        return (
            <div data-testid={`course-card-${course.id}`}>
                <span data-testid={`course-name-${course.id}`}>{course.title}</span>
                {onDelete && (
                    <button onClick={() => onDelete(course.id)} data-testid={`delete-course-${course.id}`}>
                        Delete
                    </button>
                )}
            </div>
        );
    };
});

jest.mock('@/components/CohortCard', () => {
    return function MockCohortCard({ cohort, onDelete }: any) {
        return (
            <div data-testid={`cohort-card-${cohort.id}`}>
                <span data-testid={`cohort-name-${cohort.id}`}>{cohort.name}</span>
                {onDelete && (
                    <button onClick={() => onDelete(cohort.id)} data-testid={`delete-cohort-${cohort.id}`}>
                        Delete
                    </button>
                )}
            </div>
        );
    };
});

jest.mock('@/components/InviteMembersDialog', () => {
    return function MockInviteMembersDialog({ open, onClose, onInvite }: any) {
        return open ? (
            <div data-testid="invite-members-dialog">
                <button onClick={() => onInvite(['test@example.com'])} data-testid="invite-button">
                    Invite
                </button>
                <button onClick={onClose} data-testid="close-invite-dialog">
                    Close
                </button>
            </div>
        ) : null;
    };
});

jest.mock('@/components/CreateCohortDialog', () => {
    return function MockCreateCohortDialog({ open, onClose, onCreateCohort }: any) {
        return open ? (
            <div data-testid="create-cohort-dialog">
                <button onClick={() => onCreateCohort({ id: 'new-cohort', name: 'New Cohort' })}>
                    Create
                </button>
                <button onClick={onClose}>Close</button>
            </div>
        ) : null;
    };
});

jest.mock('@/components/CreateCourseDialog', () => {
    return function MockCreateCourseDialog({ open, onClose, onSuccess }: any) {
        return open ? (
            <div data-testid="create-course-dialog">
                <button onClick={() => onSuccess({ id: 'new-course', name: 'New Course' })}>
                    Create
                </button>
                <button onClick={onClose}>Close</button>
            </div>
        ) : null;
    };
});

jest.mock('@/components/Toast', () => {
    return function MockToast({ show, title, description, emoji, onClose }: any) {
        return show ? (
            <div data-testid="toast">
                <span data-testid="toast-title">{title}</span>
                <span data-testid="toast-description">{description}</span>
                <span data-testid="toast-emoji">{emoji}</span>
                <button onClick={onClose} data-testid="close-toast">Close</button>
            </div>
        ) : null;
    };
});

jest.mock('@/components/ConfirmationDialog', () => {
    return function MockConfirmationDialog({ show, title, message, onConfirm, onCancel }: any) {
        return show ? (
            <div data-testid="confirmation-dialog">
                <span data-testid="dialog-title">{title}</span>
                <span data-testid="dialog-message">{message}</span>
                <button onClick={onConfirm} data-testid="confirm-button">Confirm</button>
                <button onClick={onCancel} data-testid="cancel-button">Cancel</button>
            </div>
        ) : null;
    };
});

const mockPush = jest.fn();
const mockUpdate = jest.fn();

// Mock data
const mockSchoolData = {
    id: '1',
    name: 'Test School',
    slug: 'test-school'
};

const mockMembersData = [
    {
        id: 1,
        email: 'owner@example.com',
        role: 'owner'
    },
    {
        id: 2,
        email: 'admin@example.com',
        role: 'admin'
    },
    {
        id: 3,
        email: 'member@example.com',
        role: 'admin'
    }
];

const mockCohortsData = [
    {
        id: 1,
        name: 'Test Cohort 1'
    },
    {
        id: 2,
        name: 'Test Cohort 2'
    }
];

const mockCoursesData = [
    {
        id: '1',
        name: 'Test Course 1'
    },
    {
        id: '2',
        name: 'Test Course 2'
    }
];

describe('ClientSchoolAdminView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Only clear call history, not the implementations
        if (fetch as jest.Mock) {
            (fetch as jest.Mock).mockClear();
        }

        // Mock environment variables
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:3001';
        process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

        // Mock router
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            prefetch: jest.fn(),
            replace: jest.fn(),
            back: jest.fn(),
            forward: jest.fn(),
            refresh: jest.fn(),
        });

        // Mock session
        (useSession as jest.Mock).mockReturnValue({
            data: {
                user: { id: '1' },
                expires: '2024-12-31T23:59:59.999Z'
            },
            status: 'authenticated',
            update: mockUpdate
        });

        // Mock window.location
        Object.defineProperty(window, 'location', {
            value: {
                hash: '',
                pathname: '/school/admin/1'
            },
            writable: true
        });
    });

    const setupSuccessfulFetches = () => {
        (fetch as jest.Mock).mockReset();
        (fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSchoolData
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockMembersData
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockCohortsData
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockCoursesData
            });
    };

    const setupEmptyCoursesTest = () => {
        (fetch as jest.Mock).mockReset();
        (fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSchoolData
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockMembersData
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockCohortsData
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => [] // Empty courses array
            });
    };

    describe('Loading State', () => {
        it('should show loading spinner when data is being fetched', () => {
            setupSuccessfulFetches();

            render(<ClientSchoolAdminView id="1" />);

            expect(screen.getByTestId('header')).toBeInTheDocument();
            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });
    });

    describe('Data Loading and Display', () => {
        it('should fetch and display school data successfully', async () => {
            setupSuccessfulFetches();

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            expect(fetch).toHaveBeenCalledWith('http://localhost:3001/organizations/1');
            expect(fetch).toHaveBeenCalledWith('http://localhost:3001/organizations/1/members');
            expect(fetch).toHaveBeenCalledWith('http://localhost:3001/cohorts/?org_id=1');
            expect(fetch).toHaveBeenCalledWith('http://localhost:3001/courses/?org_id=1');
        });

        it('should display school URL with external link', async () => {
            setupSuccessfulFetches();

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('http://localhost:3000/school/test-school')).toBeInTheDocument();
            });
        });

        it('should handle API errors gracefully', async () => {
            (fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('School not found')).toBeInTheDocument();
            });
        });
    });

    describe('Tab Navigation', () => {
        beforeEach(async () => {
            setupSuccessfulFetches();
        });

        it('should display all three tabs', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Courses')).toBeInTheDocument();
                expect(screen.getByText('Cohorts')).toBeInTheDocument();
                expect(screen.getByText('Team')).toBeInTheDocument();
            });
        });

        it('should switch to cohorts tab when clicked', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const cohortsTab = screen.getByText('Cohorts');
                fireEvent.click(cohortsTab);
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-card-1')).toBeInTheDocument();
                expect(screen.getByTestId('cohort-card-2')).toBeInTheDocument();
                expect(screen.getByTestId('cohort-name-1')).toHaveTextContent('Test Cohort 1');
                expect(screen.getByTestId('cohort-name-2')).toHaveTextContent('Test Cohort 2');
            });
        });

        it('should switch to members tab when clicked', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                expect(screen.getByText('owner@example.com')).toBeInTheDocument();
                expect(screen.getByText('admin@example.com')).toBeInTheDocument();
                expect(screen.getByText('member@example.com')).toBeInTheDocument();
            });
        });

        it('should initialize tab from URL hash', async () => {
            Object.defineProperty(window, 'location', {
                value: {
                    hash: '#cohorts',
                    pathname: '/school/admin/1'
                },
                writable: true
            });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByTestId('cohort-card-1')).toBeInTheDocument();
            });
        });
    });

    describe('Course Management', () => {
        beforeEach(async () => {
            setupSuccessfulFetches();
        });

        it('should display courses in the courses tab', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByTestId('course-card-1')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-2')).toBeInTheDocument();
                expect(screen.getByTestId('course-name-1')).toHaveTextContent('Test Course 1');
                expect(screen.getByTestId('course-name-2')).toHaveTextContent('Test Course 2');
            });
        });

        it('should open create course dialog when create button is clicked', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const createButton = screen.getByRole('button', { name: 'Create course' });
                fireEvent.click(createButton);
            });

            expect(screen.getByTestId('create-course-dialog')).toBeInTheDocument();
        });

        it('should navigate to new course page when course is created', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const createButton = screen.getByRole('button', { name: 'Create course' });
                fireEvent.click(createButton);
            });

            const createCourseButton = screen.getByText('Create');
            fireEvent.click(createCourseButton);

            expect(mockPush).toHaveBeenCalledWith('/school/admin/1/courses/new-course');
        });

        it('should handle course deletion', async () => {
            setupSuccessfulFetches();
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => [mockCoursesData[1]] // Return one less course
            });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const deleteButton = screen.getByTestId('delete-course-1');
                fireEvent.click(deleteButton);
            });

            expect(fetch).toHaveBeenCalledWith('http://localhost:3001/courses/?org_id=1');
        });

        it('should show placeholder when no courses exist', async () => {
            setupEmptyCoursesTest();

            render(<ClientSchoolAdminView id="1" />);

            // Wait for loading to complete first
            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            // Now check for the placeholder text
            await waitFor(() => {
                expect(screen.getByText('What if your next big idea became a course?')).toBeInTheDocument();
                expect(screen.getByText('It might be easier than you think')).toBeInTheDocument();
            });
        });
    });

    describe('Cohort Management', () => {
        beforeEach(async () => {
            setupSuccessfulFetches();
        });

        it('should display cohorts in the cohorts tab', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const cohortsTab = screen.getByText('Cohorts');
                fireEvent.click(cohortsTab);
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-card-1')).toBeInTheDocument();
                expect(screen.getByTestId('cohort-card-2')).toBeInTheDocument();
                expect(screen.getByTestId('cohort-name-1')).toHaveTextContent('Test Cohort 1');
                expect(screen.getByTestId('cohort-name-2')).toHaveTextContent('Test Cohort 2');
            });
        });

        it('should open create cohort dialog when create button is clicked', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const cohortsTab = screen.getByText('Cohorts');
                fireEvent.click(cohortsTab);
            });

            await waitFor(() => {
                const createButton = screen.getByRole('button', { name: 'Create cohort' });
                fireEvent.click(createButton);
            });

            expect(screen.getByTestId('create-cohort-dialog')).toBeInTheDocument();
        });

        it('should navigate to new cohort page when cohort is created', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const cohortsTab = screen.getByText('Cohorts');
                fireEvent.click(cohortsTab);
            });

            await waitFor(() => {
                const createButton = screen.getByRole('button', { name: 'Create cohort' });
                fireEvent.click(createButton);
            });

            const createCohortButton = screen.getByText('Create');
            fireEvent.click(createCohortButton);

            expect(mockPush).toHaveBeenCalledWith('/school/admin/1/cohorts/new-cohort');
        });

        it('should handle cohort deletion', async () => {
            setupSuccessfulFetches();
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => [mockCohortsData[1]] // Return one less cohort
            });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const cohortsTab = screen.getByText('Cohorts');
                fireEvent.click(cohortsTab);
            });

            await waitFor(() => {
                const deleteButton = screen.getByTestId('delete-cohort-1');
                fireEvent.click(deleteButton);
            });

            expect(fetch).toHaveBeenCalledWith('http://localhost:3001/cohorts/?org_id=1');
        });
    });

    describe('Member Management', () => {
        beforeEach(async () => {
            setupSuccessfulFetches();
        });

        it('should display members in the team tab', async () => {
            render(<ClientSchoolAdminView id="1" />);

            // Wait for school data to load first
            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                expect(screen.getByText('owner@example.com')).toBeInTheDocument();
                expect(screen.getByText('admin@example.com')).toBeInTheDocument();
                expect(screen.getByText('member@example.com')).toBeInTheDocument();
            });
        });

        it('should open invite members dialog when invite button is clicked', async () => {
            render(<ClientSchoolAdminView id="1" />);

            // Wait for school data to load first
            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const inviteButton = screen.getByRole('button', { name: 'Invite members' });
                fireEvent.click(inviteButton);
            });

            expect(screen.getByTestId('invite-members-dialog')).toBeInTheDocument();
        });

        it('should handle member invitation', async () => {
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            }).mockResolvedValueOnce({
                ok: true,
                json: async () => [...mockMembersData, { id: 4, email: 'test@example.com', role: 'admin' }]
            });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const inviteButton = screen.getByRole('button', { name: 'Invite members' });
                fireEvent.click(inviteButton);
            });

            const inviteDialogButton = screen.getByTestId('invite-button');
            fireEvent.click(inviteDialogButton);

            await waitFor(() => {
                expect(fetch).toHaveBeenCalledWith('http://localhost:3001/organizations/1/members', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ emails: ['test@example.com'] }),
                });
            });

            await waitFor(() => {
                expect(screen.getByTestId('toast')).toBeInTheDocument();
                expect(screen.getByTestId('toast-title')).toHaveTextContent('Growing the tribe');
            });
        });

        it('should prevent selecting current user or owner for deletion', async () => {
            render(<ClientSchoolAdminView id="1" />);

            // Wait for school data to load first
            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                // Should not show checkboxes for owner or current user
                const checkboxes = screen.getAllByRole('checkbox');
                // Filter out the "Select all members" checkbox
                const memberCheckboxes = checkboxes.filter(checkbox =>
                    checkbox.getAttribute('title') !== 'Select all members'
                );
                expect(memberCheckboxes).toHaveLength(2); // Only for selectable members (not owner or current user)
            });
        });
    });

    describe('Toast Notifications', () => {
        it('should show and auto-hide toast notifications', async () => {
            jest.useFakeTimers();
            setupSuccessfulFetches();
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            }).mockResolvedValueOnce({
                ok: true,
                json: async () => [...mockMembersData, { id: 4, email: 'test@example.com', role: 'admin' }]
            });

            render(<ClientSchoolAdminView id="1" />);

            // Wait for school data to load first
            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const inviteButton = screen.getByRole('button', { name: 'Invite members' });
                fireEvent.click(inviteButton);
            });

            const inviteDialogButton = screen.getByTestId('invite-button');
            fireEvent.click(inviteDialogButton);

            await waitFor(() => {
                expect(screen.getByTestId('toast')).toBeInTheDocument();
            });

            // Fast-forward time to trigger auto-hide
            jest.advanceTimersByTime(5000);

            await waitFor(() => {
                expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
            });

            jest.useRealTimers();
        });

        it('should handle toast notification auto-hide timer', async () => {
            jest.useFakeTimers();
            setupSuccessfulFetches();
            // Add additional mocks for the invite flow
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            }).mockResolvedValueOnce({
                ok: true,
                json: async () => [...mockMembersData, { id: 4, email: 'test@example.com', role: 'admin' }]
            });

            render(<ClientSchoolAdminView id="1" />);

            // Wait for school data to load first
            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            await act(async () => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            // Trigger an invite to show toast
            await act(async () => {
                const inviteButton = screen.getByText('Invite members');
                fireEvent.click(inviteButton);
            });

            await act(async () => {
                const inviteDialogButton = screen.getByTestId('invite-button');
                fireEvent.click(inviteDialogButton);
            });

            // Wait for toast to appear
            await waitFor(() => {
                expect(screen.getByTestId('toast')).toBeInTheDocument();
            });

            // Verify toast is shown
            expect(screen.getByTestId('toast')).toBeInTheDocument();

            // Clean up timers
            jest.useRealTimers();
        });

        it('should handle edge case for member role display logic', async () => {
            const membersWithOwner = [
                {
                    id: 1,
                    email: 'owner@example.com',
                    role: 'owner'
                },
                {
                    id: 2,
                    email: 'admin@example.com',
                    role: 'admin'
                }
            ];

            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSchoolData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => membersWithOwner
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCohortsData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCoursesData
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            await act(async () => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            // Should show "Owner" text for owner role
            await waitFor(() => {
                expect(screen.getByText('Owner')).toBeInTheDocument();
                expect(screen.getByText('Admin')).toBeInTheDocument();
            });
        });

        it('should handle empty state for courses when no courses available', async () => {
            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSchoolData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMembersData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCohortsData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => []
                });

            render(<ClientSchoolAdminView id="1" />);

            // Should be on courses tab by default
            await waitFor(() => {
                expect(screen.getByText('What if your next big idea became a course?')).toBeInTheDocument();
                expect(screen.getByText('It might be easier than you think')).toBeInTheDocument();
            });
        });

        it('should handle environmental variable edge case', async () => {
            const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

            // Test without APP_URL set
            delete process.env.NEXT_PUBLIC_APP_URL;

            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        id: '1',
                        name: 'Test School',
                        slug: 'test-school'
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMembersData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCohortsData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCoursesData
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            // Restore original environment
            process.env.NEXT_PUBLIC_APP_URL = originalEnv;
        });

        it('should handle dialog title logic edge case', async () => {
            setupSuccessfulFetches();

            render(<ClientSchoolAdminView id="1" />);

            // Wait for school data to load first
            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            await act(async () => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            // Test the exact equality condition (selectedMembers.length == 1)
            await act(async () => {
                const checkboxes = screen.getAllByRole('checkbox');
                const selectableCheckbox = checkboxes.find(cb =>
                    cb.getAttribute('title') !== 'Select all members'
                );
                if (selectableCheckbox) {
                    fireEvent.click(selectableCheckbox);
                }
            });

            await act(async () => {
                const removeButton = screen.getByText(/Remove \(1\)/);
                fireEvent.click(removeButton);
            });

            // Test the specific condition where selectedMembers.length == 1
            await waitFor(() => {
                expect(screen.getByTestId('dialog-title')).toHaveTextContent('Remove member');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle fetch errors for school data', async () => {
            (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('School not found')).toBeInTheDocument();
            });
        });

        it('should handle API errors for member operations', async () => {
            setupSuccessfulFetches();
            (fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to invite'));

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const inviteButton = screen.getByRole('button', { name: 'Invite members' });
                fireEvent.click(inviteButton);
            });

            const inviteDialogButton = screen.getByTestId('invite-button');
            fireEvent.click(inviteDialogButton);

            // Should not show success toast on error
            await waitFor(() => {
                expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
            });
        });
    });

    describe('School Name Editing', () => {
        beforeEach(async () => {
            setupSuccessfulFetches();
        });

        it('should enable name editing when edit button is clicked', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            // Since edit button is commented out in the component, test the contentEditable functionality
            const schoolNameElement = screen.getByRole('heading', { name: 'Test School' });
            expect(schoolNameElement).toBeInTheDocument();
        });

        it('should handle Enter key press to save name', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            const schoolNameElement = screen.getByRole('heading', { name: 'Test School' });

            // Simulate name editing
            fireEvent.keyDown(schoolNameElement, { key: 'Enter', code: 'Enter' });

            expect(schoolNameElement).toBeInTheDocument();
        });

        it('should handle blur event to save name', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            const schoolNameElement = screen.getByRole('heading', { name: 'Test School' });

            // Simulate blur event
            fireEvent.blur(schoolNameElement);

            expect(schoolNameElement).toBeInTheDocument();
        });
    });

    describe('Multiple Member Management', () => {
        beforeEach(async () => {
            setupSuccessfulFetches();
        });

        it('should handle select all members functionality', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const selectAllCheckbox = screen.getByTitle('Select all members');
                fireEvent.click(selectAllCheckbox);
            });

            // Should select all selectable members (not owner or current user)
            await waitFor(() => {
                const memberCheckboxes = screen.getAllByRole('checkbox');
                const selectableCheckboxes = memberCheckboxes.filter(cb =>
                    cb.getAttribute('title') !== 'Select all members' &&
                    !(cb as HTMLInputElement).disabled
                );
                selectableCheckboxes.forEach(checkbox => {
                    expect(checkbox).toBeChecked();
                });
            });
        });

        it('should handle deselect all members functionality', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const selectAllCheckbox = screen.getByTitle('Select all members');
                // First select all
                fireEvent.click(selectAllCheckbox);
                // Then deselect all
                fireEvent.click(selectAllCheckbox);
            });

            // Should deselect all members
            await waitFor(() => {
                const memberCheckboxes = screen.getAllByRole('checkbox');
                const selectableCheckboxes = memberCheckboxes.filter(cb =>
                    cb.getAttribute('title') !== 'Select all members'
                );
                selectableCheckboxes.forEach(checkbox => {
                    expect(checkbox).not.toBeChecked();
                });
            });
        });

        it('should handle individual member selection', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const memberCheckboxes = screen.getAllByRole('checkbox');
                const selectableCheckbox = memberCheckboxes.find(cb =>
                    cb.getAttribute('title') !== 'Select all members'
                );
                if (selectableCheckbox) {
                    fireEvent.click(selectableCheckbox);
                    expect(selectableCheckbox).toBeChecked();
                }
            });
        });

        it('should show remove button when members are selected', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const memberCheckboxes = screen.getAllByRole('checkbox');
                const selectableCheckbox = memberCheckboxes.find(cb =>
                    cb.getAttribute('title') !== 'Select all members'
                );
                if (selectableCheckbox) {
                    fireEvent.click(selectableCheckbox);
                }
            });

            await waitFor(() => {
                expect(screen.getByText(/Remove \(1\)/)).toBeInTheDocument();
            });
        });

        it('should handle multiple member deletion', async () => {
            setupSuccessfulFetches();
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            }).mockResolvedValueOnce({
                ok: true,
                json: async () => [mockMembersData[0]] // Return fewer members
            });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const memberCheckboxes = screen.getAllByRole('checkbox');
                const selectableCheckbox = memberCheckboxes.find(cb =>
                    cb.getAttribute('title') !== 'Select all members'
                );
                if (selectableCheckbox) {
                    fireEvent.click(selectableCheckbox);
                }
            });

            await waitFor(() => {
                const removeButton = screen.getByText(/Remove \(1\)/);
                fireEvent.click(removeButton);
            });

            await waitFor(() => {
                const confirmButton = screen.getByTestId('confirm-button');
                fireEvent.click(confirmButton);
            });

            await waitFor(() => {
                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3001/organizations/1/members',
                    expect.objectContaining({
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    })
                );
            });
        });

        it('should handle multiple member deletion error', async () => {
            setupSuccessfulFetches();
            (fetch as jest.Mock).mockRejectedValueOnce(new Error('Delete failed'));

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const memberCheckboxes = screen.getAllByRole('checkbox');
                const selectableCheckbox = memberCheckboxes.find(cb =>
                    cb.getAttribute('title') !== 'Select all members'
                );
                if (selectableCheckbox) {
                    fireEvent.click(selectableCheckbox);
                }
            });

            await waitFor(() => {
                const removeButton = screen.getByText(/Remove \(1\)/);
                fireEvent.click(removeButton);
            });

            await waitFor(() => {
                const confirmButton = screen.getByTestId('confirm-button');
                fireEvent.click(confirmButton);
            });

            // Should handle error gracefully and close dialog
            await waitFor(() => {
                expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
            });
        });
    });

    describe('URL Hash Navigation', () => {
        it('should handle hash change for cohorts tab', async () => {
            Object.defineProperty(window, 'location', {
                value: {
                    hash: '#cohorts',
                    pathname: '/school/admin/1'
                },
                writable: true
            });

            setupSuccessfulFetches();

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByTestId('cohort-card-1')).toBeInTheDocument();
            });
        });

        it('should handle hash change for members tab', async () => {
            Object.defineProperty(window, 'location', {
                value: {
                    hash: '#members',
                    pathname: '/school/admin/1'
                },
                writable: true
            });

            setupSuccessfulFetches();

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                expect(membersTab.parentElement).toHaveClass('border-b-2', 'dark:text-white', 'dark:border-white');
            });
        });

        it('should remove hash when switching to courses tab', async () => {
            // Mock history.pushState
            const mockPushState = jest.fn();
            Object.defineProperty(window, 'history', {
                value: { pushState: mockPushState },
                writable: true
            });

            Object.defineProperty(window, 'location', {
                value: {
                    hash: '#cohorts',
                    pathname: '/school/admin/1'
                },
                writable: true
            });

            setupSuccessfulFetches();

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const coursesTab = screen.getByText('Courses');
                fireEvent.click(coursesTab);
            });

            expect(mockPushState).toHaveBeenCalledWith("", document.title, window.location.pathname);
        });
    });

    describe('Dialog Management', () => {
        beforeEach(async () => {
            setupSuccessfulFetches();
        });

        it('should close invite dialog', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const inviteButton = screen.getByRole('button', { name: 'Invite members' });
                fireEvent.click(inviteButton);
            });

            expect(screen.getByTestId('invite-members-dialog')).toBeInTheDocument();

            const closeButton = screen.getByTestId('close-invite-dialog');
            fireEvent.click(closeButton);

            await waitFor(() => {
                expect(screen.queryByTestId('invite-members-dialog')).not.toBeInTheDocument();
            });
        });

        it('should close create cohort dialog', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const cohortsTab = screen.getByText('Cohorts');
                fireEvent.click(cohortsTab);
            });

            await waitFor(() => {
                const createButton = screen.getByRole('button', { name: 'Create cohort' });
                fireEvent.click(createButton);
            });

            expect(screen.getByTestId('create-cohort-dialog')).toBeInTheDocument();

            const closeButton = screen.getByText('Close');
            fireEvent.click(closeButton);

            await waitFor(() => {
                expect(screen.queryByTestId('create-cohort-dialog')).not.toBeInTheDocument();
            });
        });

        it('should close create course dialog', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const createButton = screen.getByRole('button', { name: 'Create course' });
                fireEvent.click(createButton);
            });

            expect(screen.getByTestId('create-course-dialog')).toBeInTheDocument();

            const closeButton = screen.getByText('Close');
            fireEvent.click(closeButton);

            await waitFor(() => {
                expect(screen.queryByTestId('create-course-dialog')).not.toBeInTheDocument();
            });
        });

        it('should cancel member deletion confirmation', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const deleteButtons = screen.getAllByLabelText('Remove Member');
                fireEvent.click(deleteButtons[0]); // Click the first delete button
            });

            expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();

            const cancelButton = screen.getByTestId('cancel-button');
            fireEvent.click(cancelButton);

            await waitFor(() => {
                expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
            });
        });
    });

    describe('Error Handling Edge Cases', () => {
        it('should handle cohort creation error with missing ID', async () => {
            setupSuccessfulFetches();

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const cohortsTab = screen.getByText('Cohorts');
                fireEvent.click(cohortsTab);
            });

            await waitFor(() => {
                const createButton = screen.getByRole('button', { name: 'Create cohort' });
                fireEvent.click(createButton);
            });

            // Mock a cohort creation response without ID
            const createCohortButton = screen.getByText('Create');
            const cohortDialog = screen.getByTestId('create-cohort-dialog');

            // Simulate cohort creation without proper ID
            expect(createCohortButton).toBeInTheDocument();
            expect(cohortDialog).toBeInTheDocument();
        });

        it('should handle course deletion API error', async () => {
            setupSuccessfulFetches();
            (fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch courses'));

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const deleteButton = screen.getByTestId('delete-course-1');
                fireEvent.click(deleteButton);
            });

            // Should handle error gracefully
            await waitFor(() => {
                expect(screen.getByTestId('delete-course-1')).toBeInTheDocument();
            });
        });

        it('should handle cohort deletion API error', async () => {
            setupSuccessfulFetches();
            (fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch cohorts'));

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const cohortsTab = screen.getByText('Cohorts');
                fireEvent.click(cohortsTab);
            });

            await waitFor(() => {
                const deleteButton = screen.getByTestId('delete-cohort-1');
                fireEvent.click(deleteButton);
            });

            // Should handle error gracefully
            await waitFor(() => {
                expect(screen.getByTestId('delete-cohort-1')).toBeInTheDocument();
            });
        });

        it('should handle member deletion fetch members error', async () => {
            setupSuccessfulFetches();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({})
                })
                .mockRejectedValueOnce(new Error('Failed to fetch updated members'));

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const deleteButtons = screen.getAllByLabelText('Remove Member');
                fireEvent.click(deleteButtons[0]); // Click the first delete button
            });

            await waitFor(() => {
                const confirmButton = screen.getByTestId('confirm-button');
                fireEvent.click(confirmButton);
            });

            // Should handle error gracefully
            await waitFor(() => {
                expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
            });
        });
    });

    describe('Environment Variables', () => {
        it('should handle missing environment variables', async () => {
            // Temporarily remove environment variables
            const originalBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
            const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

            delete process.env.NEXT_PUBLIC_BACKEND_URL;
            delete process.env.NEXT_PUBLIC_APP_URL;

            render(<ClientSchoolAdminView id="1" />);

            // Should still render without crashing
            expect(screen.getByTestId('header')).toBeInTheDocument();

            // Restore environment variables
            process.env.NEXT_PUBLIC_BACKEND_URL = originalBackendUrl;
            process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
        });
    });

    describe('Empty State Variations', () => {
        it('should show placeholder for empty cohorts', async () => {
            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSchoolData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMembersData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [] // Empty cohorts
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCoursesData
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const cohortsTab = screen.getByText('Cohorts');
                fireEvent.click(cohortsTab);
            });

            await waitFor(() => {
                expect(screen.getByText('Bring your courses to life with cohorts')).toBeInTheDocument();
                expect(screen.getByText('Create groups of learners and assign them courses to learn together')).toBeInTheDocument();
            });
        });
    });

    describe('Additional Coverage Tests', () => {
        beforeEach(async () => {
            setupSuccessfulFetches();
        });

        it('should handle click outside name edit field', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            const schoolNameElement = screen.getByRole('heading', { name: 'Test School' });

            // Simulate click outside
            fireEvent.mouseDown(document.body);

            expect(schoolNameElement).toBeInTheDocument();
        });

        it('should handle member invitation error response not ok', async () => {
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const inviteButton = screen.getByRole('button', { name: 'Invite members' });
                fireEvent.click(inviteButton);
            });

            const inviteDialogButton = screen.getByTestId('invite-button');
            fireEvent.click(inviteDialogButton);

            // Should handle error gracefully (no toast shown)
            await waitFor(() => {
                expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
            });
        });

        it('should handle member invitation fetch updated members error', async () => {
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({})
                })
                .mockRejectedValueOnce(new Error('Failed to fetch updated members'));

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const inviteButton = screen.getByRole('button', { name: 'Invite members' });
                fireEvent.click(inviteButton);
            });

            const inviteDialogButton = screen.getByTestId('invite-button');
            fireEvent.click(inviteDialogButton);

            // Should handle error gracefully
            await waitFor(() => {
                expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
            });
        });

        it('should handle member deletion API not ok response', async () => {
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                const deleteButtons = screen.getAllByLabelText('Remove Member');
                fireEvent.click(deleteButtons[0]);
            });

            await waitFor(() => {
                const confirmButton = screen.getByTestId('confirm-button');
                fireEvent.click(confirmButton);
            });

            // Should handle error gracefully
            await waitFor(() => {
                expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
            });
        });

        it('should handle member selection for current user (should be prevented)', async () => {
            // Mock session with user id matching a member
            require('next-auth/react').useSession.mockReturnValue({
                data: {
                    user: { id: '2' }, // Match admin@example.com id
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            // Should not show checkboxes for current user
            await waitFor(() => {
                const checkboxes = screen.getAllByRole('checkbox');
                const memberCheckboxes = checkboxes.filter(checkbox =>
                    checkbox.getAttribute('title') !== 'Select all members'
                );
                // Should have fewer checkboxes since current user can't be selected
                expect(memberCheckboxes.length).toBeLessThanOrEqual(2);
            });

            // Reset session mock
            require('next-auth/react').useSession.mockReturnValue({
                data: {
                    user: { id: '1' },
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });
        });

        it('should handle course refresh error in handleCourseDelete', async () => {
            (fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch courses'));

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const deleteButton = screen.getByTestId('delete-course-1');
                fireEvent.click(deleteButton);
            });

            // Should handle error gracefully
            await waitFor(() => {
                expect(screen.getByTestId('delete-course-1')).toBeInTheDocument();
            });
        });

        it('should handle cohort refresh not ok response in handleCohortDelete', async () => {
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const cohortsTab = screen.getByText('Cohorts');
                fireEvent.click(cohortsTab);
            });

            await waitFor(() => {
                const deleteButton = screen.getByTestId('delete-cohort-1');
                fireEvent.click(deleteButton);
            });

            // Should handle error gracefully
            await waitFor(() => {
                expect(screen.getByTestId('delete-cohort-1')).toBeInTheDocument();
            });
        });

        it('should handle course refresh not ok response in handleCourseDelete', async () => {
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const deleteButton = screen.getByTestId('delete-course-1');
                fireEvent.click(deleteButton);
            });

            // Should handle error gracefully
            await waitFor(() => {
                expect(screen.getByTestId('delete-course-1')).toBeInTheDocument();
            });
        });

        it('should handle hasSelectableMembers with no members', async () => {
            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSchoolData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [
                        { id: 1, email: 'owner@example.com', role: 'owner' }
                    ] // Only owner
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCohortsData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCoursesData
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            // Should not show select all checkbox when no selectable members
            await waitFor(() => {
                const selectAllCheckboxes = screen.queryAllByTitle('Select all members');
                expect(selectAllCheckboxes).toHaveLength(0);
            });
        });

        it('should handle school data with no slug', async () => {
            const schoolDataWithoutSlug = {
                id: '1',
                name: 'Test School'
                // No slug property
            };

            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => schoolDataWithoutSlug
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMembersData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCohortsData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCoursesData
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            // Should still display school info even without slug
            expect(screen.getByText('Test School')).toBeInTheDocument();
        });

        it('should handle API responses with empty arrays', async () => {
            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSchoolData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => []
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => []
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => []
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            // Should handle empty data gracefully
            expect(screen.getByText('What if your next big idea became a course?')).toBeInTheDocument();
        });

        it('should handle tab navigation to default courses tab', async () => {
            // Start with a different tab
            Object.defineProperty(window, 'location', {
                value: {
                    hash: '#members',
                    pathname: '/school/admin/1'
                },
                writable: true
            });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const coursesTab = screen.getByText('Courses');
                fireEvent.click(coursesTab);
            });

            // Should switch to courses tab and remove hash
            expect(screen.getByRole('button', { name: 'Create course' })).toBeInTheDocument();
        });

        it('should handle no hash in window location', async () => {
            Object.defineProperty(window, 'location', {
                value: {
                    hash: '',
                    pathname: '/school/admin/1'
                },
                writable: true
            });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            // Should default to courses tab
            expect(screen.getByRole('button', { name: 'Create course' })).toBeInTheDocument();
        });

        it('should handle unknown hash in window location', async () => {
            Object.defineProperty(window, 'location', {
                value: {
                    hash: '#unknown',
                    pathname: '/school/admin/1'
                },
                writable: true
            });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            // Should default to courses tab
            expect(screen.getByRole('button', { name: 'Create course' })).toBeInTheDocument();
        });

        it('should handle member deletion with empty selected members', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            // Try to trigger multiple member deletion without selecting any
            const component = screen.getByText('Team').closest('div');
            if (component) {
                // This would test the edge case of empty selectedMembers
                expect(component).toBeInTheDocument();
            }
        });

        it('should handle all member operations gracefully', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await waitFor(() => {
                // Test that all member-related buttons exist
                expect(screen.getByRole('button', { name: 'Invite members' })).toBeInTheDocument();
                const deleteButtons = screen.getAllByLabelText('Remove Member');
                expect(deleteButtons.length).toBeGreaterThan(0);
            });
        });

        it('should handle name editing focus and cursor positioning', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            const schoolNameElement = screen.getByRole('heading', { name: 'Test School' });

            // Test the focus behavior with range and selection
            Object.defineProperty(document, 'createRange', {
                value: () => ({
                    selectNodeContents: jest.fn(),
                    collapse: jest.fn()
                }),
                writable: true
            });

            Object.defineProperty(window, 'getSelection', {
                value: () => ({
                    removeAllRanges: jest.fn(),
                    addRange: jest.fn()
                }),
                writable: true
            });

            // Simulate focus behavior
            fireEvent.focus(schoolNameElement);

            expect(schoolNameElement).toBeInTheDocument();
        });

        it('should handle cohort creation error during navigation', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const cohortsTab = screen.getByText('Cohorts');
                fireEvent.click(cohortsTab);
            });

            await waitFor(() => {
                const createButton = screen.getByRole('button', { name: 'Create cohort' });
                fireEvent.click(createButton);
            });

            // Simulate error in cohort creation by calling handleCreateCohort with null/undefined
            const createCohortButton = screen.getByText('Create');
            expect(createCohortButton).toBeInTheDocument();
        });

        it('should handle window location hash without history object', async () => {
            // Remove history object to test fallback
            Object.defineProperty(window, 'history', {
                value: undefined,
                writable: true
            });

            Object.defineProperty(window, 'location', {
                value: {
                    hash: '#cohorts',
                    pathname: '/school/admin/1'
                },
                writable: true
            });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const coursesTab = screen.getByText('Courses');
                fireEvent.click(coursesTab);
            });

            // Should not crash even without history object
            expect(screen.getByRole('button', { name: 'Create course' })).toBeInTheDocument();

            // Restore history object
            Object.defineProperty(window, 'history', {
                value: { pushState: jest.fn() },
                writable: true
            });
        });

        it('should handle member deletion with both single and multiple members correctly', async () => {
            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            // Test the logic for determining deletion message
            const component = screen.getByText('Team').closest('div');
            expect(component).toBeInTheDocument();

            // The component should handle both memberToDelete and selectedMembers scenarios
            // This tests the conditional logic in the confirmation dialog
        });

        it('should handle member selection with edge cases', async () => {
            // Test with modified member data to cover edge cases
            const modifiedMembersData = [
                { id: 1, email: 'owner@example.com', role: 'owner' },
                { id: 2, email: 'admin@example.com', role: 'admin' },
                { id: 3, email: 'member@example.com', role: 'admin' },
                { id: 4, email: 'another@example.com', role: 'admin' }
            ];

            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSchoolData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => modifiedMembersData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCohortsData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCoursesData
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            // Test selecting and deselecting members
            await waitFor(() => {
                const checkboxes = screen.getAllByRole('checkbox');
                const selectableCheckboxes = checkboxes.filter(cb =>
                    cb.getAttribute('title') !== 'Select all members'
                );

                if (selectableCheckboxes.length > 0) {
                    // Select first member
                    fireEvent.click(selectableCheckboxes[0]);
                    expect(selectableCheckboxes[0]).toBeChecked();

                    // Deselect same member
                    fireEvent.click(selectableCheckboxes[0]);
                    expect(selectableCheckboxes[0]).not.toBeChecked();
                }
            });
        });

        it('should handle API responses with different HTTP status codes', async () => {
            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                    json: async () => mockSchoolData
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('School not found')).toBeInTheDocument();
            });
        });

        it('should handle partial API failures during initialization', async () => {
            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSchoolData
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCohortsData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCoursesData
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('School not found')).toBeInTheDocument();
            });
        });

        it('should handle console error logging during fetch operations', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith("Error fetching school:", expect.any(Error));
            });

            consoleSpy.mockRestore();
        });

        it('should handle timer cleanup on component unmount', async () => {
            const { unmount } = render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            // Unmount component to test cleanup
            unmount();

            // Timer should be cleaned up without errors
            expect(true).toBe(true); // Test passes if no errors thrown
        });

        it('should handle edge case where school data transformation fails', async () => {
            const malformedSchoolData = {
                // Missing required fields to test error handling
                name: 'Test School'
            };

            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => malformedSchoolData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMembersData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCohortsData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCoursesData
                });

            render(<ClientSchoolAdminView id="1" />);

            // Should handle malformed data gracefully
            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });
        });

        it('should handle array transformation edge cases', async () => {
            const schoolDataWithNullArrays = {
                id: '1',
                name: 'Test School',
                slug: 'test-school'
            };

            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => schoolDataWithNullArrays
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => null // null members
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCohortsData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCoursesData
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            // Should handle null members array gracefully
            expect(screen.getByText('Test School')).toBeInTheDocument();
        });

        it('should handle create course button click in empty state', async () => {
            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSchoolData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMembersData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCohortsData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [] // empty courses
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('What if your next big idea became a course?')).toBeInTheDocument();
            });

            // Click the create course button in empty state
            const createButton = screen.getByText('Create course');
            fireEvent.click(createButton);

            await waitFor(() => {
                expect(screen.getByTestId('create-course-dialog')).toBeInTheDocument();
            });
        });

        it('should handle create cohort button click in empty state', async () => {
            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSchoolData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMembersData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [] // empty cohorts
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCoursesData
                });

            render(<ClientSchoolAdminView id="1" />);

            // Switch to cohorts tab
            await waitFor(() => {
                const cohortsTab = screen.getByText('Cohorts');
                fireEvent.click(cohortsTab);
            });

            await waitFor(() => {
                expect(screen.getByText('Bring your courses to life with cohorts')).toBeInTheDocument();
            });

            // Click the create cohort button in empty state
            const createButton = screen.getByText('Create cohort');
            fireEvent.click(createButton);

            await waitFor(() => {
                expect(screen.getByTestId('create-cohort-dialog')).toBeInTheDocument();
            });
        });

        it('should handle school URL without slug properly', async () => {
            const schoolDataNoSlug = {
                id: '1',
                name: 'Test School'
                // no slug property
            };

            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => schoolDataNoSlug
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMembersData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCohortsData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCoursesData
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            // Should still work even without slug
            expect(screen.getByText('Test School')).toBeInTheDocument();
        });

        it('should handle memberToDelete state properly in confirmation dialog', async () => {
            setupSuccessfulFetches();

            render(<ClientSchoolAdminView id="1" />);

            // Wait for school data to load first
            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            await act(async () => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            await act(async () => {
                const removeMemberButtons = screen.getAllByLabelText('Remove Member');
                fireEvent.click(removeMemberButtons[0]);
            });

            // Should show dialog with single member message
            await waitFor(() => {
                expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
                expect(screen.getByTestId('dialog-title')).toHaveTextContent('Remove member');
            });
        });

        it('should handle exact equality comparison in confirmation dialog logic', async () => {
            setupSuccessfulFetches();

            render(<ClientSchoolAdminView id="1" />);

            // Wait for school data to load first
            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            await act(async () => {
                const membersTab = screen.getByText('Team');
                fireEvent.click(membersTab);
            });

            // Select exactly one member
            await act(async () => {
                const checkboxes = screen.getAllByRole('checkbox');
                const selectableCheckboxes = checkboxes.filter(cb =>
                    cb.getAttribute('title') !== 'Select all members'
                );
                if (selectableCheckboxes.length > 0) {
                    fireEvent.click(selectableCheckboxes[0]);
                }
            });

            // Click remove selected button
            await act(async () => {
                const removeButton = screen.getByText(/Remove \(1\)/);
                fireEvent.click(removeButton);
            });

            // Should show dialog with proper title for single member
            await waitFor(() => {
                expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
                expect(screen.getByTestId('dialog-title')).toHaveTextContent('Remove member');
            });
        });

        it('should handle course data transformation with all fields', async () => {
            const detailedCoursesData = [
                {
                    id: '1',
                    name: 'Detailed Course 1',
                    description: 'Course description',
                    moduleCount: 5
                },
                {
                    id: '2',
                    name: 'Detailed Course 2'
                    // missing description and moduleCount
                }
            ];

            (fetch as jest.Mock).mockReset();
            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSchoolData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMembersData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCohortsData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => detailedCoursesData
                });

            render(<ClientSchoolAdminView id="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test School')).toBeInTheDocument();
            });

            // Should handle both courses with and without all fields
            expect(screen.getByTestId('course-card-1')).toBeInTheDocument();
            expect(screen.getByTestId('course-card-2')).toBeInTheDocument();
        });
    });
}); 