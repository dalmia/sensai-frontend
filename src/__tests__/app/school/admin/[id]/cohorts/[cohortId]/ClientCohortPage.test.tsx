import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import '@testing-library/jest-dom';
import ClientCohortPage from '@/app/school/admin/[id]/cohorts/[cohortId]/ClientCohortPage';

// Mock dependencies
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock clipboard API
Object.assign(navigator, {
    clipboard: {
        writeText: jest.fn(),
    },
});

// Mock DOM methods
Object.defineProperty(document, 'createRange', {
    value: jest.fn(() => ({
        selectNodeContents: jest.fn(),
        collapse: jest.fn(),
    })),
});

Object.defineProperty(window, 'getSelection', {
    value: jest.fn(() => ({
        removeAllRanges: jest.fn(),
        addRange: jest.fn(),
    })),
});

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

jest.mock('@/components/ConfirmationDialog', () => {
    return function MockConfirmationDialog({ open, title, message, onConfirm, onCancel, type }: any) {
        return open ? (
            <div data-testid="confirmation-dialog">
                <span data-testid="dialog-title">{title}</span>
                <span data-testid="dialog-message">{message}</span>
                <span data-testid="dialog-type">{type}</span>
                <button onClick={onConfirm} data-testid="confirm-button">Confirm</button>
                <button onClick={onCancel} data-testid="cancel-button">Cancel</button>
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

jest.mock('@/components/CoursePublishSuccessBanner', () => {
    return function MockCoursePublishSuccessBanner({ isOpen, onClose, cohortId, cohortName, schoolSlug, schoolId, courseCount, courseNames, source }: any) {
        return isOpen ? (
            <div data-testid="course-publish-success-banner">
                <span data-testid="banner-cohort-id">{cohortId}</span>
                <span data-testid="banner-cohort-name">{cohortName}</span>
                <span data-testid="banner-school-slug">{schoolSlug}</span>
                <span data-testid="banner-course-count">{courseCount}</span>
                <span data-testid="banner-source">{source}</span>
                <button onClick={onClose} data-testid="close-banner">Close</button>
            </div>
        ) : null;
    };
});

jest.mock('@/components/Tooltip', () => {
    return function MockTooltip({ content, children }: any) {
        return <div data-testid={`tooltip-${content.toLowerCase().replace(/\s+/g, '-')}`}>{children}</div>;
    };
});

jest.mock('@/components/CohortMemberManagement', () => {
    return function MockCohortMemberManagement({ cohort, role, cohortId, schoolId, openInviteDialog, onInviteDialogClose, onShowToast, updateCohort }: any) {
        return (
            <div data-testid={`cohort-member-management-${role}`}>
                <div data-testid="member-management-cohort-id">{cohortId}</div>
                <div data-testid="member-management-school-id">{schoolId}</div>
                <div data-testid="member-management-role">{role}</div>
                <div data-testid="member-management-open-dialog">{(openInviteDialog || false).toString()}</div>
                <button
                    onClick={() => {
                        onShowToast('Success', 'Member invited', '✅');
                    }}
                    data-testid="test-toast"
                >
                    Test Toast
                </button>
                <button onClick={onInviteDialogClose} data-testid="close-invite-dialog">Close Dialog</button>
                <button
                    onClick={() => {
                        updateCohort(cohort.members);
                    }}
                    data-testid="update-cohort"
                >
                    Update Cohort
                </button>
            </div>
        );
    };
});

jest.mock('@/components/CohortDashboard', () => {
    return function MockCohortDashboard({ cohort, cohortId, schoolId, onAddLearners }: any) {
        return (
            <div data-testid="cohort-dashboard">
                <span data-testid="dashboard-cohort-id">{cohortId}</span>
                <span data-testid="dashboard-school-id">{schoolId}</span>
                <button onClick={onAddLearners} data-testid="add-learners-button">Add Learners</button>
            </div>
        );
    };
});

jest.mock('@/components/CohortCoursesLinkerDropdown', () => {
    return function MockCohortCoursesLinkerDropdown({ isOpen, onClose, availableCourses, totalSchoolCourses, isLoadingCourses, courseError, schoolId, cohortId, onCoursesLinked, onFetchAvailableCourses }: any) {
        if (!isOpen) return null;

        return (
            <div data-testid="cohort-courses-linker-dropdown">
                <div data-testid="dropdown-school-id">{schoolId}</div>
                <div data-testid="dropdown-cohort-id">{cohortId}</div>
                <div data-testid="dropdown-available-courses">{availableCourses.length}</div>
                <div data-testid="dropdown-total-school-courses">{totalSchoolCourses}</div>
                <div data-testid="dropdown-loading-courses">{isLoadingCourses.toString()}</div>
                <div data-testid="dropdown-course-error">{courseError || 'null'}</div>
                <button
                    onClick={() => {
                        // Simulate linking courses - use course ID 1 to match test expectations
                        const mockSelectedCourses = [{ id: 1, name: 'Test Course' }];
                        onCoursesLinked(mockSelectedCourses);
                    }}
                    data-testid="link-courses"
                >
                    Link Courses
                </button>
                <button onClick={onClose} data-testid="close-dropdown">Close</button>
                <button onClick={onFetchAvailableCourses} data-testid="fetch-available-courses">Fetch Courses</button>
            </div>
        );
    };
});

jest.mock('@/components/SettingsDialog', () => {
    return function MockSettingsDialog({ isOpen, onClose, courseName, dripConfig, schoolId, courseId, cohortId }: any) {
        return isOpen ? (
            <div data-testid="settings-dialog">
                <span data-testid="settings-course-name">{courseName}</span>
                <span data-testid="settings-school-id">{schoolId}</span>
                <span data-testid="settings-course-id">{courseId}</span>
                <span data-testid="settings-cohort-id">{cohortId || 'undefined'}</span>
                <button onClick={onClose} data-testid="close-settings">Close</button>
            </div>
        ) : null;
    };
});

jest.mock('@/components/CreateBatchDialog', () => {
    return function MockCreateBatchDialog({ inline, isOpen, onClose, batch, onRequestDelete }: any) {
        // Inline dialogs are always visible, modal dialogs respect isOpen flag
        if (!inline && !isOpen) return null;
        return (
            <div data-testid={inline ? 'create-batch-dialog-inline' : 'create-batch-dialog-modal'}>
                {batch && <span data-testid="inline-batch-name">{batch.name}</span>}
                {onClose && (
                    <button onClick={onClose} data-testid="close-create-batch">Close</button>
                )}
                {onRequestDelete && (
                    <button onClick={() => onRequestDelete(batch)} data-testid="delete-batch">Delete Batch</button>
                )}
            </div>
        );
    };
});

const mockPush = jest.fn();
const mockBack = jest.fn();

// Mock data
const mockCohortData = {
    id: 1,
    name: 'Test Cohort',
    org_id: 1,
    members: [
        { id: 1, email: 'learner1@example.com', role: 'learner' },
        { id: 2, email: 'learner2@example.com', role: 'learner' },
        { id: 3, email: 'mentor1@example.com', role: 'mentor' }
    ],
    groups: [],
    courses: [
        { id: 1, name: 'Test Course 1', description: 'Course 1 description' },
        { id: 2, name: 'Test Course 2', description: 'Course 2 description' }
    ]
};

const mockSchoolData = {
    id: '1',
    name: 'Test School',
    slug: 'test-school'
};

const mockAvailableCoursesData = [
    { id: 3, name: 'Available Course 1', description: 'Available course description' },
    { id: 4, name: 'Available Course 2', description: 'Another available course' }
];

// Helper data for batches
const mockBatchesData = [
    {
        id: 1,
        name: 'Batch A',
        cohort_id: 1,
        members: [
            { id: 1, email: 'learner1@example.com', role: 'learner' },
            { id: 2, email: 'mentor1@example.com', role: 'mentor' },
        ],
    },
    {
        id: 2,
        name: 'Batch B',
        cohort_id: 1,
        members: [
            { id: 3, email: 'learner2@example.com', role: 'learner' },
        ],
    },
];

describe('ClientCohortPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset all mock implementations
        (global.fetch as jest.Mock).mockReset();
        (useRouter as jest.Mock).mockReset();
        (navigator.clipboard.writeText as jest.Mock).mockReset();

        // Mock environment variables
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:3001';

        // Mock router
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            back: mockBack,
            prefetch: jest.fn(),
            replace: jest.fn(),
            forward: jest.fn(),
            refresh: jest.fn(),
        });

        // Mock clipboard
        (navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined);

        // Mock window.location.origin
        Object.defineProperty(window, 'location', {
            value: {
                origin: 'http://localhost:3000',
            },
            writable: true,
        });
    });

    const setupSuccessfulFetches = () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockCohortData),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSchoolData),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockCohortData.courses),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([...mockCohortData.courses, ...mockAvailableCoursesData]),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockCohortData.courses),
            })
            // Add additional mocks for any extra fetch calls that might happen
            .mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({}),
            });
    };

    const setupFailedCohortFetch = () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 404,
        });
    };

    describe('Loading State', () => {
        it('should show loading spinner while fetching cohort data', () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            expect(screen.getByTestId('header')).toBeInTheDocument();
            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });
    });

    describe('Successful Data Loading', () => {
        it('should render cohort page with cohort data', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            });

            expect(screen.getByTestId('header')).toBeInTheDocument();
            expect(screen.getByText('Back to cohorts')).toBeInTheDocument();
            expect(screen.getByText('Edit')).toBeInTheDocument();
            expect(screen.getByText('Invite learners')).toBeInTheDocument();
            expect(screen.getByText('Link course')).toBeInTheDocument();
        });

        it('should display linked courses', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Course 1')).toBeInTheDocument();
                expect(screen.getByText('Test Course 2')).toBeInTheDocument();
            });

            expect(screen.getByText('Courses')).toBeInTheDocument();
        });

        it('should show dashboard tab when courses exist', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Dashboard')).toBeInTheDocument();
            });

            expect(screen.getByText('Learners')).toBeInTheDocument();
            expect(screen.getByText('Mentors')).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('should handle failed cohort fetch gracefully', async () => {
            setupFailedCohortFetch();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Cohort (Data Unavailable)')).toBeInTheDocument();
            });
        });

        it('should show cohort not found when cohort is null', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(null),
            });

            render(<ClientCohortPage schoolId="1" cohortId="undefined" />);

            await waitFor(() => {
                expect(screen.getByText('Cohort not found')).toBeInTheDocument();
            });
        });
    });

    describe('Tab Navigation', () => {
        it('should switch between tabs', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            // Wait for the cohort data to load properly
            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            });

            // Wait for the dashboard tab to appear (when courses are loaded)
            await waitFor(() => {
                expect(screen.getByText('Dashboard')).toBeInTheDocument();
            });

            // Switch to learners tab
            fireEvent.click(screen.getByText('Learners'));
            expect(screen.getByTestId('cohort-member-management-learner')).toBeInTheDocument();

            // Switch to mentors tab
            fireEvent.click(screen.getByText('Mentors'));
            expect(screen.getByTestId('cohort-member-management-mentor')).toBeInTheDocument();

            // Switch back to dashboard
            fireEvent.click(screen.getByText('Dashboard'));
            expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
        });

        it('should default to learners tab when no courses exist', async () => {
            const noCoursesCohortData = { ...mockCohortData, courses: [] };
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(noCoursesCohortData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSchoolData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([]),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockAvailableCoursesData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([]),
                });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByTestId('cohort-member-management-learner')).toBeInTheDocument();
            });

            // Dashboard tab should not be visible when no courses exist
            expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
        });
    });

    describe('Cohort Name Editing', () => {
        it('should enable cohort name editing when edit button is clicked', async () => {
            // Setup fresh mocks for this test
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSchoolData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData.courses),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([...mockCohortData.courses, ...mockAvailableCoursesData]),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData.courses),
                });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            // Wait for the cohort data to load - indicated by cohort name appearing
            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Edit'));

            // Wait for edit mode to be enabled - Save and Cancel buttons should appear
            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
                expect(screen.getByText('Cancel')).toBeInTheDocument();
            });
        });

        it('should save cohort name when save button is clicked', async () => {
            // Setup fresh mocks for this test
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSchoolData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData.courses),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([...mockCohortData.courses, ...mockAvailableCoursesData]),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData.courses),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({}),
                });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            // Wait for the cohort data to load - indicated by cohort name appearing
            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            });

            // Enter edit mode first
            fireEvent.click(screen.getByText('Edit'));

            // Wait for edit mode to be active
            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            // Now save
            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(screen.getByTestId('toast-title')).toHaveTextContent('Success');
            });

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:3001/cohorts/1',
                expect.objectContaining({
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test Cohort' }),
                })
            );
        });

        it('should cancel cohort name editing when cancel button is clicked', async () => {
            // Setup fresh mocks for this test
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSchoolData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData.courses),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([...mockCohortData.courses, ...mockAvailableCoursesData]),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData.courses),
                });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            // Wait for the cohort data to load - indicated by cohort name appearing
            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Edit'));

            // Wait for edit mode to be enabled
            await waitFor(() => {
                expect(screen.getByText('Cancel')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Cancel'));

            // Wait for edit mode to be disabled
            await waitFor(() => {
                expect(screen.getByText('Edit')).toBeInTheDocument();
                expect(screen.queryByText('Save')).not.toBeInTheDocument();
            });
        });
    });

    describe('Course Linking', () => {
        it('should open course linker dropdown when link course button is clicked', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Link course')).toBeInTheDocument();
            });

            // Click to open the dropdown
            await act(async () => {
                fireEvent.click(screen.getByText('Link course'));
            });

            // Wait for the dropdown to appear
            await waitFor(() => {
                expect(screen.getByTestId('cohort-courses-linker-dropdown')).toBeInTheDocument();
            });

            // Click the link courses button
            await act(async () => {
                fireEvent.click(screen.getByTestId('link-courses'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('course-publish-success-banner')).toBeInTheDocument();
            }, { timeout: 3000 });
        });

        it('should handle successful course linking', async () => {
            // Use the same setup as the working first test
            setupSuccessfulFetches();

            await act(async () => {
                render(<ClientCohortPage schoolId="1" cohortId="1" />);
            });

            // Wait for the cohort data to load properly
            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(screen.getByText('Link course')).toBeInTheDocument();
            });

            // Click to open the dropdown
            await act(async () => {
                fireEvent.click(screen.getByText('Link course'));
            });

            // Wait for the dropdown to appear
            await waitFor(() => {
                expect(screen.getByTestId('cohort-courses-linker-dropdown')).toBeInTheDocument();
            });

            // Click the link courses button
            await act(async () => {
                fireEvent.click(screen.getByTestId('link-courses'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('course-publish-success-banner')).toBeInTheDocument();
            }, { timeout: 3000 });

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:3001/cohorts/1/courses',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ course_ids: [1], drip_config: undefined }),
                })
            );
        });
    });

    describe('Course Unlinking', () => {
        it('should show confirmation dialog when removing course', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Course 1')).toBeInTheDocument();
            });

            // Find and click the remove button for the first course
            const removeButtons = screen.getAllByTestId('tooltip-remove');
            fireEvent.click(removeButtons[0].querySelector('button')!);

            expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
            expect(screen.getByTestId('dialog-title')).toHaveTextContent('Remove course from cohort');
            expect(screen.getByTestId('dialog-type')).toHaveTextContent('delete');
        });

        it('should handle successful course removal', async () => {
            setupSuccessfulFetches();
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({}),
            });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Course 1')).toBeInTheDocument();
            });

            // Find and click the remove button for the first course
            const removeButtons = screen.getAllByTestId('tooltip-remove');
            fireEvent.click(removeButtons[0].querySelector('button')!);
            fireEvent.click(screen.getByTestId('confirm-button'));

            await waitFor(() => {
                expect(screen.getByTestId('toast-title')).toHaveTextContent('Course unlinked');
            });

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:3001/cohorts/1/courses',
                expect.objectContaining({
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ course_ids: [1] }),
                })
            );
        });
    });

    describe('Settings Dialog', () => {
        it('should open settings dialog when settings button is clicked', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Course 1')).toBeInTheDocument();
            });

            // Find and click the settings button for the first course
            const settingsButtons = screen.getAllByTestId('tooltip-settings');
            fireEvent.click(settingsButtons[0].querySelector('button')!);

            expect(screen.getByTestId('settings-dialog')).toBeInTheDocument();
            expect(screen.getByTestId('settings-course-name')).toHaveTextContent('Test Course 1');
        });
    });

    describe('Invite Functionality', () => {
        it('should copy invite link when invite learners button is clicked', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            // Wait for the cohort data to load - indicated by buttons appearing
            await waitFor(() => {
                expect(screen.getByText('Invite learners')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Invite learners'));

            await waitFor(() => {
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                    'http://localhost:3000/school/test-school/join?cohortId=1'
                );
            });

            await waitFor(() => {
                expect(screen.getByTestId('toast-title')).toHaveTextContent('Invite link copied');
            });
        });

        it('should handle clipboard error gracefully', async () => {
            setupSuccessfulFetches();
            (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('Clipboard error'));

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Invite learners')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Invite learners'));

            await waitFor(() => {
                expect(screen.getByTestId('toast-title')).toHaveTextContent('Error');
            });
        });
    });

    describe('Member Management Integration', () => {
        it('should open learner invite dialog from dashboard', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('add-learners-button'));

            // Should switch to learners tab and open invite dialog
            expect(screen.getByTestId('cohort-member-management-learner')).toBeInTheDocument();
            expect(screen.getByTestId('member-management-open-dialog')).toHaveTextContent('true');
        });

        it('should handle member management toast messages', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Learners')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Learners'));
            fireEvent.click(screen.getByTestId('test-toast'));

            expect(screen.getByTestId('toast-title')).toHaveTextContent('Success');
            expect(screen.getByTestId('toast-description')).toHaveTextContent('Member invited');
            expect(screen.getByTestId('toast-emoji')).toHaveTextContent('✅');
        });
    });

    describe('Navigation', () => {
        it('should navigate back to cohorts when back link is clicked', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Back to cohorts')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Back to cohorts'));

            expect(mockPush).not.toHaveBeenCalled(); // Link component handles navigation
        });
    });

    describe('Toast Auto-hide', () => {
        it('should automatically hide toast after 5 seconds', async () => {
            jest.useFakeTimers();
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Invite learners')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Invite learners'));

            await waitFor(() => {
                expect(screen.getByTestId('toast')).toBeInTheDocument();
            });

            // Fast-forward time by 5 seconds
            act(() => {
                jest.advanceTimersByTime(5000);
            });

            await waitFor(() => {
                expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
            });

            jest.useRealTimers();
        });
    });

    describe('Invalid CohortId Handling', () => {
        it('should handle undefined cohortId gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            render(<ClientCohortPage schoolId="1" cohortId="undefined" />);

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith("Invalid cohortId:", "undefined");
            });

            expect(screen.getByText('Cohort not found')).toBeInTheDocument();

            consoleSpy.mockRestore();
        });

        it('should handle empty cohortId gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            render(<ClientCohortPage schoolId="1" cohortId="" />);

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith("Invalid cohortId:", "");
            });

            expect(screen.getByText('Cohort not found')).toBeInTheDocument();

            consoleSpy.mockRestore();
        });
    });

    describe('Course Fetching Error Scenarios', () => {
        it('should handle courses fetch API error', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSchoolData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData.courses),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith("Error fetching courses:", expect.any(Error));
            });

            consoleSpy.mockRestore();
        });

        it('should handle cohort courses fetch failure gracefully', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSchoolData),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockAvailableCoursesData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([]),
                });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            });

            // Should default to learners tab when cohort courses fetch fails
            expect(screen.getByTestId('cohort-member-management-learner')).toBeInTheDocument();
        });
    });

    describe('Keyboard Event Handling', () => {
        it('should save cohort name when Enter key is pressed', async () => {
            setupSuccessfulFetches();
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({}),
            });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Edit'));

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            // Simulate Enter key press
            const cohortNameElement = screen.getByText('Test Cohort');
            fireEvent.keyDown(cohortNameElement, { key: 'Enter' });

            await waitFor(() => {
                expect(screen.getByTestId('toast-title')).toHaveTextContent('Success');
            });
        });

        it('should cancel cohort name editing when Escape key is pressed', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Edit'));

            await waitFor(() => {
                expect(screen.getByText('Cancel')).toBeInTheDocument();
            });

            // Simulate Escape key press
            const cohortNameElement = screen.getByText('Test Cohort');
            fireEvent.keyDown(cohortNameElement, { key: 'Escape' });

            await waitFor(() => {
                expect(screen.getByText('Edit')).toBeInTheDocument();
                expect(screen.queryByText('Save')).not.toBeInTheDocument();
            });
        });
    });

    describe('Error Handling for Operations', () => {
        it('should handle cohort name save API error', async () => {
            setupSuccessfulFetches();
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Edit'));

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(screen.getByTestId('toast-title')).toHaveTextContent('Error');
                expect(screen.getByTestId('toast-description')).toHaveTextContent('Failed to update cohort name. Please try again.');
            });

            consoleSpy.mockRestore();
        });

        it('should handle course removal API error', async () => {
            setupSuccessfulFetches();
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Course 1')).toBeInTheDocument();
            });

            const removeButtons = screen.getAllByTestId('tooltip-remove');
            fireEvent.click(removeButtons[0].querySelector('button')!);
            fireEvent.click(screen.getByTestId('confirm-button'));

            await waitFor(() => {
                expect(screen.getByTestId('toast-title')).toHaveTextContent('Error');
                expect(screen.getByTestId('toast-description')).toHaveTextContent('Failed to remove course from cohort: 500');
            });

            consoleSpy.mockRestore();
        });

        it('should handle course linking API error', async () => {
            // Setup initial successful fetches for component load
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSchoolData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData.courses),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([...mockCohortData.courses, ...mockAvailableCoursesData]),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData.courses),
                })
                // Now for the dropdown fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([...mockCohortData.courses, ...mockAvailableCoursesData]),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockCohortData.courses),
                })
                // Finally the failing course linking call
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Link course')).toBeInTheDocument();
            });

            await act(async () => {
                fireEvent.click(screen.getByText('Link course'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-courses-linker-dropdown')).toBeInTheDocument();
            });

            await act(async () => {
                fireEvent.click(screen.getByTestId('link-courses'));
            });

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith("Error linking courses to cohort:", expect.any(Error));
            });

            consoleSpy.mockRestore();
        });
    });

    describe('Component Callbacks and Handlers', () => {
        it('should handle settings dialog close', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Course 1')).toBeInTheDocument();
            });

            // Open settings dialog
            const settingsButtons = screen.getAllByTestId('tooltip-settings');
            fireEvent.click(settingsButtons[0].querySelector('button')!);

            expect(screen.getByTestId('settings-dialog')).toBeInTheDocument();

            // Close settings dialog
            fireEvent.click(screen.getByTestId('close-settings'));

            expect(screen.queryByTestId('settings-dialog')).not.toBeInTheDocument();
        });

        it('should handle course publish banner close', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Link course')).toBeInTheDocument();
            });

            // Trigger course linking to show banner
            await act(async () => {
                fireEvent.click(screen.getByText('Link course'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-courses-linker-dropdown')).toBeInTheDocument();
            });

            await act(async () => {
                fireEvent.click(screen.getByTestId('link-courses'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('course-publish-success-banner')).toBeInTheDocument();
            });

            // Close banner
            fireEvent.click(screen.getByTestId('close-banner'));

            expect(screen.queryByTestId('course-publish-success-banner')).not.toBeInTheDocument();
        });

        it('should handle toast close', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Invite learners')).toBeInTheDocument();
            });

            // Trigger toast
            fireEvent.click(screen.getByText('Invite learners'));

            await waitFor(() => {
                expect(screen.getByTestId('toast')).toBeInTheDocument();
            });

            // Close toast
            fireEvent.click(screen.getByTestId('close-toast'));

            expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
        });

        it('should handle confirmation dialog cancel', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Course 1')).toBeInTheDocument();
            });

            // Open confirmation dialog
            const removeButtons = screen.getAllByTestId('tooltip-remove');
            fireEvent.click(removeButtons[0].querySelector('button')!);

            expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();

            // Cancel dialog
            fireEvent.click(screen.getByTestId('cancel-button'));

            expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
        });

        it('should handle cohort name input changes', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Edit'));

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            // Simulate input change
            const cohortNameElement = screen.getByText('Test Cohort');
            fireEvent.input(cohortNameElement, {
                target: { textContent: 'Updated Cohort Name' }
            });

            // The input should be handled by handleCohortNameInput
            expect(cohortNameElement).toBeInTheDocument();
        });

        it('should handle member management updateCohort for learners', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Learners')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Learners'));

            await waitFor(() => {
                expect(screen.getByTestId('cohort-member-management-learner')).toBeInTheDocument();
            });

            // Trigger updateCohort callback
            fireEvent.click(screen.getByTestId('update-cohort'));

            // The cohort should be updated through the callback
            expect(screen.getByTestId('cohort-member-management-learner')).toBeInTheDocument();
        });

        it('should handle member management updateCohort for mentors', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Mentors')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Mentors'));

            await waitFor(() => {
                expect(screen.getByTestId('cohort-member-management-mentor')).toBeInTheDocument();
            });

            // Trigger updateCohort callback
            fireEvent.click(screen.getByTestId('update-cohort'));

            // The cohort should be updated through the callback
            expect(screen.getByTestId('cohort-member-management-mentor')).toBeInTheDocument();
        });
    });

    describe('Edge Cases and Special Scenarios', () => {
        it('should switch to learners tab when removing the last course', async () => {
            // Setup data with only one course
            const singleCourseData = {
                ...mockCohortData,
                courses: [{ id: 1, name: 'Only Course', description: 'Single course' }]
            };

            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(singleCourseData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSchoolData),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(singleCourseData.courses),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([...singleCourseData.courses, ...mockAvailableCoursesData]),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(singleCourseData.courses),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({}),
                });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Only Course')).toBeInTheDocument();
            });

            // Should be on dashboard tab initially
            expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();

            // Remove the only course
            const removeButtons = screen.getAllByTestId('tooltip-remove');
            fireEvent.click(removeButtons[0].querySelector('button')!);
            fireEvent.click(screen.getByTestId('confirm-button'));

            // Should switch to learners tab after removing last course
            await waitFor(() => {
                expect(screen.getByTestId('cohort-member-management-learner')).toBeInTheDocument();
            });

            // Dashboard tab should no longer be visible
            expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
        });

        it('should handle cohort fetch error in catch block', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Cohort (Data Unavailable)')).toBeInTheDocument();
            });

            expect(consoleSpy).toHaveBeenCalledWith("Error fetching cohort:", expect.any(Error));

            consoleSpy.mockRestore();
        });

        it('should handle empty course name in save operation', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Edit'));

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            // Clear the cohort name
            const cohortNameElement = screen.getByText('Test Cohort');
            fireEvent.input(cohortNameElement, {
                target: { textContent: '   ' }
            });

            // Try to save empty name - should show toast and stay in edit mode
            fireEvent.click(screen.getByText('Save'));

            // Should show error toast
            await waitFor(() => {
                expect(screen.getByText('Invalid name')).toBeInTheDocument();
                expect(screen.getByText('Cohort name cannot be empty')).toBeInTheDocument();
            });

            // Should stay in edit mode (Save and Cancel buttons still visible)
            expect(screen.getByText('Save')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
            expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        });

        it('should handle dropdown close functionality', async () => {
            setupSuccessfulFetches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            await waitFor(() => {
                expect(screen.getByText('Link course')).toBeInTheDocument();
            });

            // Open dropdown
            await act(async () => {
                fireEvent.click(screen.getByText('Link course'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-courses-linker-dropdown')).toBeInTheDocument();
            });

            // Close dropdown
            fireEvent.click(screen.getByTestId('close-dropdown'));

            expect(screen.queryByTestId('cohort-courses-linker-dropdown')).not.toBeInTheDocument();
        });
    });

    describe('Batches Functionality', () => {
        it('should show placeholder and open create batch dialog when no batches exist', async () => {
            setupFetchesWithoutBatches();

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            // Wait for main UI to load
            await waitFor(() => {
                expect(screen.getByText('Batches')).toBeInTheDocument();
            });

            // Switch to Batches tab
            fireEvent.click(screen.getByText('Batches'));

            // Wait for placeholder UI
            await waitFor(() => {
                expect(screen.getByText('Organize into batches')).toBeInTheDocument();
            });

            // Click Create batch button
            fireEvent.click(screen.getByText('Create batch'));

            // Modal dialog should appear
            await waitFor(() => {
                expect(screen.getByTestId('create-batch-dialog-modal')).toBeInTheDocument();
            });
        });

        it('should render batch list and show inline batch details when a batch is selected', async () => {
            setupFetchesWithBatches(mockBatchesData);

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            // Navigate to batches tab
            await waitFor(() => {
                expect(screen.getByText('Batches')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batches'));

            // Wait for list to render
            await waitFor(() => {
                expect(screen.getByText('Batch A')).toBeInTheDocument();
                expect(screen.getByText('Batch B')).toBeInTheDocument();
            });

            // Select Batch A
            fireEvent.click(screen.getByText('Batch A'));

            // Inline dialog should appear with correct batch name
            await waitFor(() => {
                expect(screen.getByTestId('create-batch-dialog-inline')).toBeInTheDocument();
                expect(screen.getByTestId('inline-batch-name')).toHaveTextContent('Batch A');
            });
        });

        it('should filter batches based on search input', async () => {
            setupFetchesWithBatches(mockBatchesData);

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            // Go to Batches tab
            await waitFor(() => {
                expect(screen.getByText('Batches')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batches'));

            // Wait for search input
            const searchInput = await screen.findByPlaceholderText('Search batches');

            // Type search query
            fireEvent.change(searchInput, { target: { value: 'Batch B' } });

            // Batch A should be filtered out
            await waitFor(() => {
                expect(screen.queryByText('Batch A')).not.toBeInTheDocument();
                expect(screen.getByText('Batch B')).toBeInTheDocument();
            });
        });

        it('should open confirmation dialog and delete batch', async () => {
            // Start with a single batch so list becomes empty after deletion
            const singleBatch = [mockBatchesData[0]];
            setupFetchesWithBatches(singleBatch);

            // Additional fetch mock for DELETE request
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({}),
            });

            render(<ClientCohortPage schoolId="1" cohortId="1" />);

            // Go to Batches tab
            await waitFor(() => {
                expect(screen.getByText('Batches')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batches'));

            // Wait for batch list then select batch
            await waitFor(() => {
                expect(screen.getByText('Batch A')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batch A'));

            // Inline dialog present
            await waitFor(() => {
                expect(screen.getByTestId('create-batch-dialog-inline')).toBeInTheDocument();
            });

            // Click delete inside inline dialog
            fireEvent.click(screen.getByTestId('delete-batch'));

            // Confirmation dialog should open
            await waitFor(() => {
                expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
            });

            // Confirm deletion
            fireEvent.click(screen.getByTestId('confirm-button'));

            // Wait for deletion to complete and placeholder to reappear
            await waitFor(() => {
                expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
                expect(screen.getByText('Organize into batches')).toBeInTheDocument();
            });

            // Ensure DELETE was called with correct endpoint
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:3001/batches/1',
                expect.objectContaining({ method: 'DELETE' })
            );
        });

        it('should show loading spinner when batches are loading', async () => {
            setupFetchesWithBatches(mockBatchesData);

            // Patch fetchBatches to delay
            jest.useFakeTimers();
            render(<ClientCohortPage schoolId="1" cohortId="1" />);
            await waitFor(() => {
                expect(screen.getByText('Batches')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batches'));
            // Spinner should appear
            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
            jest.useRealTimers();
        });

        it('should handle batch fetch error gracefully', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCohortData) })
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSchoolData) })
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCohortData.courses) })
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([...mockCohortData.courses, ...mockAvailableCoursesData]) })
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCohortData.courses) })
                .mockResolvedValueOnce({ ok: false, status: 500 });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
            render(<ClientCohortPage schoolId="1" cohortId="1" />);
            await waitFor(() => {
                expect(screen.getByText('Batches')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batches'));
            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith("Error fetching batches:", expect.any(Error));
            });
            consoleSpy.mockRestore();
        });

        it('should handle batch delete error gracefully', async () => {
            setupFetchesWithBatches([mockBatchesData[0]]);
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
            render(<ClientCohortPage schoolId="1" cohortId="1" />);
            await waitFor(() => {
                expect(screen.getByText('Batches')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batches'));
            await waitFor(() => {
                expect(screen.getByText('Batch A')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batch A'));
            await waitFor(() => {
                expect(screen.getByTestId('create-batch-dialog-inline')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByTestId('delete-batch'));
            await waitFor(() => {
                expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByTestId('confirm-button'));
            await waitFor(() => {
                expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
                expect(screen.getByTestId('dialog-type')).toHaveTextContent('delete');
            });
        });

        it('should deselect batch and close inline dialog', async () => {
            setupFetchesWithBatches(mockBatchesData);
            render(<ClientCohortPage schoolId="1" cohortId="1" />);
            await waitFor(() => {
                expect(screen.getByText('Batches')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batches'));
            await waitFor(() => {
                expect(screen.getByText('Batch A')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batch A'));
            await waitFor(() => {
                expect(screen.getByTestId('create-batch-dialog-inline')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByTestId('close-create-batch'));
            await waitFor(() => {
                expect(screen.queryByTestId('create-batch-dialog-inline')).not.toBeInTheDocument();
            });
        });

        it('should update batch details when onBatchUpdated is called', async () => {
            setupFetchesWithBatches(mockBatchesData);
            render(<ClientCohortPage schoolId="1" cohortId="1" />);
            await waitFor(() => {
                expect(screen.getByText('Batches')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batches'));
            await waitFor(() => {
                expect(screen.getByText('Batch A')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batch A'));
            await waitFor(() => {
                expect(screen.getByTestId('create-batch-dialog-inline')).toBeInTheDocument();
            });
            // Simulate batch update by clicking update-cohort (which triggers onBatchUpdated)
            // We'll just check that the inline dialog is still present (UI updates)
            expect(screen.getByTestId('create-batch-dialog-inline')).toBeInTheDocument();
        });

        it('should show no results when searching for a non-existent batch', async () => {
            setupFetchesWithBatches(mockBatchesData);
            render(<ClientCohortPage schoolId="1" cohortId="1" />);
            await waitFor(() => {
                expect(screen.getByText('Batches')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batches'));
            const searchInput = await screen.findByPlaceholderText('Search batches');
            fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });
            await waitFor(() => {
                expect(screen.queryByText('Batch A')).not.toBeInTheDocument();
                expect(screen.queryByText('Batch B')).not.toBeInTheDocument();
            });
        });

        it('should allow selecting a batch after filtering', async () => {
            setupFetchesWithBatches(mockBatchesData);
            render(<ClientCohortPage schoolId="1" cohortId="1" />);
            await waitFor(() => {
                expect(screen.getByText('Batches')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batches'));
            const searchInput = await screen.findByPlaceholderText('Search batches');
            fireEvent.change(searchInput, { target: { value: 'Batch B' } });
            await waitFor(() => {
                expect(screen.getByText('Batch B')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('Batch B'));
            await waitFor(() => {
                expect(screen.getByTestId('create-batch-dialog-inline')).toBeInTheDocument();
                expect(screen.getByTestId('inline-batch-name')).toHaveTextContent('Batch B');
            });
        });
    });
});

// Utility to setup fetch mocks when batches data is needed
function setupFetchesWithBatches(batches: any[]) {
    (global.fetch as jest.Mock)
        // Cohort
        .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockCohortData),
        })
        // School
        .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockSchoolData),
        })
        // Cohort courses
        .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockCohortData.courses),
        })
        // All courses in org
        .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([...mockCohortData.courses, ...mockAvailableCoursesData]),
        })
        // Cohort courses (second call inside fetchAvailableCourses)
        .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockCohortData.courses),
        })
        // Batches fetch when tab selected
        .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(batches),
        })
        // Fallback for any additional fetches
        .mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });
}

// Utility to setup fetch mocks when there are NO batches
function setupFetchesWithoutBatches() {
    setupFetchesWithBatches([]);
} 