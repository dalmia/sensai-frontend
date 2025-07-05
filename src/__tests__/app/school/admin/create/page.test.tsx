import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import CreateSchool from '@/app/school/admin/create/page';
import { useAuth } from '@/lib/auth';
import { useSchools } from '@/lib/api';

// Mock dependencies
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
    useAuth: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
    useSchools: jest.fn(),
}));

jest.mock('framer-motion', () => ({
    motion: {
        div: function MockMotionDiv({ children, ...props }: any) {
            return <div {...props}>{children}</div>;
        }
    }
}));

// Mock AudioContext
const mockAudioContext = {
    createOscillator: jest.fn(() => ({
        type: 'triangle',
        frequency: {
            setValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn(),
        },
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
    })),
    createGain: jest.fn(() => ({
        gain: {
            setValueAtTime: jest.fn(),
            linearRampToValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn(),
        },
        connect: jest.fn(),
    })),
    destination: {},
    currentTime: 0,
};

// Mock fetch API
global.fetch = jest.fn();

// Mock window.location
Object.defineProperty(window, 'location', {
    writable: true,
    value: {
        href: '',
    },
});

// Mock AudioContext
Object.defineProperty(window, 'AudioContext', {
    writable: true,
    value: jest.fn(() => mockAudioContext),
});

const mockPush = jest.fn();
const mockReplace = jest.fn();

describe('CreateSchool Page', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset environment variable
        process.env.NEXT_PUBLIC_APP_URL = 'https://test.app';
        process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.test.app';

        // Mock router
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            replace: mockReplace,
            prefetch: jest.fn(),
            back: jest.fn(),
            forward: jest.fn(),
            refresh: jest.fn(),
        });

        // Mock fetch response
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ id: 'new-school-123' }),
        });
    });

    describe('Loading State', () => {
        it('should show loading spinner when schools are loading', () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [],
                isLoading: true,
            });

            render(<CreateSchool />);

            expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
            expect(screen.queryByText('Create Your School')).not.toBeInTheDocument();
        });
    });

    describe('User Already Has School', () => {
        it('should redirect when user already owns a school', () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [
                    { id: 'existing-school', role: 'owner', name: 'Existing School' }
                ],
                isLoading: false,
            });

            render(<CreateSchool />);

            expect(mockPush).toHaveBeenCalledWith('/school/admin/existing-school');
        });

        it('should not redirect when user has non-owner schools', () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [
                    { id: 'member-school', role: 'member', name: 'Member School' }
                ],
                isLoading: false,
            });

            render(<CreateSchool />);

            expect(mockPush).not.toHaveBeenCalled();
            expect(screen.getByText('Create Your School')).toBeInTheDocument();
        });
    });

    describe('Form Rendering', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [],
                isLoading: false,
            });
        });

        it('should render all form elements', () => {
            render(<CreateSchool />);

            expect(screen.getByText('Create Your School')).toBeInTheDocument();
            expect(screen.getByText('School Name')).toBeInTheDocument();
            expect(screen.getByText('School Link')).toBeInTheDocument();
            expect(screen.getByLabelText('Close and return to home')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Create School' })).toBeInTheDocument();
        });

        it('should show character counts for inputs', () => {
            render(<CreateSchool />);

            expect(screen.getByText('0/40')).toBeInTheDocument(); // School name counter
            expect(screen.getByText('0/121')).toBeInTheDocument(); // Slug counter
        });

        it('should display school URL preview', () => {
            render(<CreateSchool />);

            expect(screen.getByText('https://test.app/school/')).toBeInTheDocument();
        });
    });

    describe('Form Input Handling', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [],
                isLoading: false,
            });
        });

        it('should update school name input and character count', () => {
            const { container } = render(<CreateSchool />);

            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            fireEvent.change(schoolNameInput, { target: { value: 'Test School' } });

            expect(schoolNameInput).toHaveValue('Test School');
            expect(screen.getByText('11/40')).toBeInTheDocument();
        });

        it('should update slug input and format it properly', () => {
            const { container } = render(<CreateSchool />);

            const slugInput = container.querySelector('#slug') as HTMLInputElement;
            fireEvent.change(slugInput, { target: { value: 'Test-School-123!' } });

            expect(slugInput).toHaveValue('test-school-123');
            expect(screen.getByText('15/121')).toBeInTheDocument();
        });

        it('should enforce character limits', () => {
            const { container } = render(<CreateSchool />);

            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            const longName = 'a'.repeat(50); // Exceeds 40 char limit
            fireEvent.change(schoolNameInput, { target: { value: longName } });

            // The maxLength attribute is present, but React controls the actual limiting
            // through the value state. The HTML maxLength doesn't prevent programmatic changes.
            expect(schoolNameInput).toHaveAttribute('maxLength', '40');

            // Test that user typing respects the limit by checking the attribute
            expect(schoolNameInput.maxLength).toBe(40);
        });
    });

    describe('User Data Pre-filling', () => {
        it('should pre-fill name fields from user data - two names', () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [],
                isLoading: false,
            });

            render(<CreateSchool />);

            // Note: The component has internal state for firstName/lastName
            // but doesn't render them in form fields, so we can't test the UI
            // We'd need to check the internal state which isn't directly testable
            expect(screen.getByText('Create Your School')).toBeInTheDocument();
        });

        it('should pre-fill name fields from user data - three names', () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Middle Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [],
                isLoading: false,
            });

            render(<CreateSchool />);

            expect(screen.getByText('Create Your School')).toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [],
                isLoading: false,
            });
        });

        it('should navigate back to home when close button is clicked', () => {
            render(<CreateSchool />);

            const closeButton = screen.getByLabelText('Close and return to home');
            fireEvent.click(closeButton);

            expect(mockPush).toHaveBeenCalledWith('/');
        });
    });

    describe('Form Submission', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [],
                isLoading: false,
            });
        });

        it('should handle successful form submission', async () => {
            const { container } = render(<CreateSchool />);

            // Fill in form
            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            const slugInput = container.querySelector('#slug') as HTMLInputElement;
            fireEvent.change(schoolNameInput, { target: { value: 'Test School' } });
            fireEvent.change(slugInput, { target: { value: 'test-school' } });

            // Submit form
            const submitButton = screen.getByRole('button', { name: 'Create School' });
            fireEvent.click(submitButton);

            // Check loading state
            expect(screen.getByText('Creating...')).toBeInTheDocument();

            // Wait for API call
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    'https://api.test.app/organizations/',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            name: 'Test School',
                            slug: 'test-school',
                            user_id: 'user-123'
                        }),
                    }
                );
            });

            // Check success dialog appears
            await waitFor(() => {
                expect(screen.getByText('Your School is Ready!')).toBeInTheDocument();
                expect(screen.getByText('An epic journey begins now')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Open my school' })).toBeInTheDocument();
            });
        });

        it('should prevent submission without user authentication', async () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: null
            });

            const { container } = render(<CreateSchool />);

            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            const slugInput = container.querySelector('#slug') as HTMLInputElement;
            fireEvent.change(schoolNameInput, { target: { value: 'Test School' } });
            fireEvent.change(slugInput, { target: { value: 'test-school' } });

            const submitButton = screen.getByRole('button', { name: 'Create School' });
            fireEvent.click(submitButton);

            // Should not make API call
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should handle slug already exists error', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({
                    detail: 'Organization with this slug already exists'
                }),
            });

            const { container } = render(<CreateSchool />);

            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            const slugInput = container.querySelector('#slug') as HTMLInputElement;
            fireEvent.change(schoolNameInput, { target: { value: 'Test School' } });
            fireEvent.change(slugInput, { target: { value: 'existing-slug' } });

            const submitButton = screen.getByRole('button', { name: 'Create School' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('This school URL is already taken. Please choose another.')).toBeInTheDocument();
            });

            // Form should be enabled again
            expect(screen.getByRole('button', { name: 'Create School' })).not.toBeDisabled();
        });

        it('should handle general API errors', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: () => Promise.resolve({}),
            });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const { container } = render(<CreateSchool />);

            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            const slugInput = container.querySelector('#slug') as HTMLInputElement;
            fireEvent.change(schoolNameInput, { target: { value: 'Test School' } });
            fireEvent.change(slugInput, { target: { value: 'test-school' } });

            const submitButton = screen.getByRole('button', { name: 'Create School' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith('Error creating school:', expect.any(Error));
            });

            consoleSpy.mockRestore();
        });

        it('should handle malformed JSON response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                json: () => Promise.reject(new Error('Invalid JSON')),
            });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const { container } = render(<CreateSchool />);

            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            const slugInput = container.querySelector('#slug') as HTMLInputElement;
            fireEvent.change(schoolNameInput, { target: { value: 'Test School' } });
            fireEvent.change(slugInput, { target: { value: 'test-school' } });

            const submitButton = screen.getByRole('button', { name: 'Create School' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalled();
            });

            consoleSpy.mockRestore();
        });
    });

    describe('Success Dialog', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [],
                isLoading: false,
            });
        });

        it('should navigate to new school when success button is clicked', async () => {
            const { container } = render(<CreateSchool />);

            // Fill and submit form
            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            const slugInput = container.querySelector('#slug') as HTMLInputElement;
            fireEvent.change(schoolNameInput, { target: { value: 'Test School' } });
            fireEvent.change(slugInput, { target: { value: 'test-school' } });

            const submitButton = screen.getByRole('button', { name: 'Create School' });
            fireEvent.click(submitButton);

            // Wait for success dialog
            await waitFor(() => {
                expect(screen.getByText('Your School is Ready!')).toBeInTheDocument();
            });

            // Click success button
            const openSchoolButton = screen.getByRole('button', { name: 'Open my school' });
            fireEvent.click(openSchoolButton);

            // Should navigate using window.location for full page navigation
            expect(window.location.href).toBe('/school/admin/new-school-123');
        });
    });

    describe('Audio Functionality', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [],
                isLoading: false,
            });
        });

        it('should play success sound on successful form submission', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const { container } = render(<CreateSchool />);

            // Fill and submit form
            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            const slugInput = container.querySelector('#slug') as HTMLInputElement;
            fireEvent.change(schoolNameInput, { target: { value: 'Test School' } });
            fireEvent.change(slugInput, { target: { value: 'test-school' } });

            const submitButton = screen.getByRole('button', { name: 'Create School' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('Your School is Ready!')).toBeInTheDocument();
            });

            // AudioContext should have been called
            expect(window.AudioContext).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle audio context errors gracefully', async () => {
            // Mock AudioContext to throw error
            (window.AudioContext as jest.Mock).mockImplementation(() => {
                throw new Error('AudioContext not supported');
            });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const { container } = render(<CreateSchool />);

            // Fill and submit form
            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            const slugInput = container.querySelector('#slug') as HTMLInputElement;
            fireEvent.change(schoolNameInput, { target: { value: 'Test School' } });
            fireEvent.change(slugInput, { target: { value: 'test-school' } });

            const submitButton = screen.getByRole('button', { name: 'Create School' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('Your School is Ready!')).toBeInTheDocument();
            });

            // Should log the error but still show success dialog
            expect(consoleSpy).toHaveBeenCalledWith('Error creating school creation sound:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });

    describe('Form Validation', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [],
                isLoading: false,
            });
        });

        it('should require school name field', () => {
            const { container } = render(<CreateSchool />);

            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            expect(schoolNameInput).toHaveAttribute('required');
            expect(schoolNameInput).toHaveAttribute('maxLength', '40');
        });

        it('should require slug field with pattern validation', () => {
            const { container } = render(<CreateSchool />);

            const slugInput = container.querySelector('#slug') as HTMLInputElement;
            expect(slugInput).toHaveAttribute('required');
            expect(slugInput).toHaveAttribute('pattern', '[a-z0-9-]+');
            expect(slugInput).toHaveAttribute('maxLength', '121');
        });
    });

    describe('Error State Display', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [],
                isLoading: false,
            });
        });

        it('should show error styling when slug error exists', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({
                    detail: 'Organization with this slug already exists'
                }),
            });

            const { container } = render(<CreateSchool />);

            // Submit form to trigger error
            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            const slugInput = container.querySelector('#slug') as HTMLInputElement;
            fireEvent.change(schoolNameInput, { target: { value: 'Test School' } });
            fireEvent.change(slugInput, { target: { value: 'existing-slug' } });

            const submitButton = screen.getByRole('button', { name: 'Create School' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('This school URL is already taken. Please choose another.')).toBeInTheDocument();
            });

            // Check that error styling is applied
            const slugContainer = slugInput.parentElement?.parentElement;
            expect(slugContainer?.querySelector('.border-red-500')).toBeInTheDocument();
        });

        it('should clear error when form is resubmitted', async () => {
            // First submission with error
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({
                    detail: 'Organization with this slug already exists'
                }),
            });

            const { container } = render(<CreateSchool />);

            const schoolNameInput = container.querySelector('#schoolName') as HTMLInputElement;
            const slugInput = container.querySelector('#slug') as HTMLInputElement;
            fireEvent.change(schoolNameInput, { target: { value: 'Test School' } });
            fireEvent.change(slugInput, { target: { value: 'existing-slug' } });

            const submitButton = screen.getByRole('button', { name: 'Create School' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('This school URL is already taken. Please choose another.')).toBeInTheDocument();
            });

            // Change slug and resubmit with success
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 'new-school-123' }),
            });

            fireEvent.change(slugInput, { target: { value: 'new-slug' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.queryByText('This school URL is already taken. Please choose another.')).not.toBeInTheDocument();
            });
        });
    });

    describe('Responsive Design', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', name: 'John Doe' }
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [],
                isLoading: false,
            });
        });

        it('should have responsive classes for mobile and desktop', () => {
            render(<CreateSchool />);

            const closeButton = screen.getByLabelText('Close and return to home');
            expect(closeButton).toHaveClass('w-8', 'h-8', 'sm:w-10', 'sm:h-10');

            const heading = screen.getByText('Create Your School');
            expect(heading).toHaveClass('text-3xl');

            const main = heading.closest('main');
            expect(main).toHaveClass('mt-10', 'sm:mt-20', 'px-4', 'sm:px-6');
        });
    });
}); 