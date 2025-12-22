import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsDialog from '../../components/SettingsDialog';
import { DripConfig } from '@/types/course';

// Mock the Tooltip component
jest.mock('../../components/Tooltip', () => {
    return function MockTooltip({ children }: { children: React.ReactNode }) {
        return <div>{children}</div>;
    };
});

describe('SettingsDialog Component', () => {
    const defaultProps = {
        isOpen: false,
        onClose: jest.fn(),
        courseName: 'Test Course',
        dripConfig: {
            is_drip_enabled: false,
            frequency_value: 1,
            frequency_unit: 'week',
            publish_at: null
        } as DripConfig,
        schoolId: 'test-school',
        courseId: 123,
        cohortId: undefined,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not render when isOpen is false', () => {
        render(<SettingsDialog {...defaultProps} />);

        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('renders when isOpen is true', () => {
        render(<SettingsDialog {...defaultProps} isOpen={true} />);

        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Course')).toBeInTheDocument();
        expect(screen.getByText('Test Course')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        const mockOnClose = jest.fn();
        render(<SettingsDialog {...defaultProps} isOpen={true} onClose={mockOnClose} />);

        const closeButton = screen.getByLabelText('Close');
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked', () => {
        const mockOnClose = jest.fn();
        render(<SettingsDialog {...defaultProps} isOpen={true} onClose={mockOnClose} />);

        const overlay = screen.getByText('Settings').closest('.fixed');
        fireEvent.click(overlay!);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when dialog content is clicked', () => {
        const mockOnClose = jest.fn();
        render(<SettingsDialog {...defaultProps} isOpen={true} onClose={mockOnClose} />);

        const dialogContent = screen.getByText('Settings').closest('.max-w-md');
        fireEvent.click(dialogContent!);

        expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('displays course information correctly', () => {
        render(<SettingsDialog {...defaultProps} isOpen={true} />);

        expect(screen.getByText('Course')).toBeInTheDocument();
        expect(screen.getByText('Test Course')).toBeInTheDocument();
        expect(screen.getByLabelText('Open cohort page')).toBeInTheDocument();
    });

    it('displays cohort information when courseId is undefined', () => {
        render(<SettingsDialog {...defaultProps} isOpen={true} courseId={undefined} cohortId={456} />);

        expect(screen.getByText('Cohort')).toBeInTheDocument();
        expect(screen.getByText('Test Course')).toBeInTheDocument();
    });

    it('displays drip schedule when enabled', () => {
        const dripConfig = {
            is_drip_enabled: true,
            frequency_value: 2,
            frequency_unit: 'week',
            publish_at: new Date('2024-01-01T10:00:00Z')
        } as DripConfig;

        render(<SettingsDialog {...defaultProps} isOpen={true} dripConfig={dripConfig} />);

        expect(screen.getByText('Course release schedule')).toBeInTheDocument();
        expect(screen.getByText(/Every 2 weeks/)).toBeInTheDocument();
        expect(screen.getByText(/starting from/)).toBeInTheDocument();
    });

    it('displays no drip schedule message when disabled', () => {
        render(<SettingsDialog {...defaultProps} isOpen={true} />);

        expect(screen.getByText('Course release schedule')).toBeInTheDocument();
        expect(screen.getByText(/This course is not using a drip schedule/)).toBeInTheDocument();
    });

    it('handles missing courseName gracefully', () => {
        render(<SettingsDialog {...defaultProps} isOpen={true} courseName="" />);

        expect(screen.getByText('Settings')).toBeInTheDocument();
        // Component should still render without errors
        expect(screen.getByText('Course')).toBeInTheDocument();
    });

    it('handles empty dripConfig', () => {
        render(<SettingsDialog {...defaultProps} isOpen={true} dripConfig={{} as DripConfig} />);

        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('handles undefined courseId', () => {
        render(<SettingsDialog {...defaultProps} isOpen={true} courseId={undefined} cohortId={456} />);

        expect(screen.getByText('Cohort')).toBeInTheDocument();
    });

    it('opens external link when open button is clicked', () => {
        // Mock window.open
        const mockWindowOpen = jest.fn();
        window.open = mockWindowOpen;

        render(<SettingsDialog {...defaultProps} isOpen={true} />);

        const openButton = screen.getByLabelText('Open cohort page');
        fireEvent.click(openButton);

        expect(mockWindowOpen).toHaveBeenCalledWith(
            '/school/admin/test-school/courses/123',
            '_blank'
        );
    });

    it('calls onCopyCohortInviteLink when share button is clicked', () => {
        const mockOnCopyCohortInviteLink = jest.fn();
        render(
            <SettingsDialog
                {...defaultProps}
                isOpen={true}
                courseId={undefined}
                cohortId={456}
                onCopyCohortInviteLink={mockOnCopyCohortInviteLink}
            />
        );

        const shareButton = screen.getByLabelText('Copy cohort invite link');
        fireEvent.click(shareButton);

        expect(mockOnCopyCohortInviteLink).toHaveBeenCalledWith(456, 'Test Course');
    });

    it('does not show share button when onCopyCohortInviteLink is not provided', () => {
        render(<SettingsDialog {...defaultProps} isOpen={true} cohortId={456} />);

        expect(screen.queryByLabelText('Copy cohort invite link')).not.toBeInTheDocument();
    });

    it('formats frequency text correctly for singular values', () => {
        const dripConfig = {
            is_drip_enabled: true,
            frequency_value: 1,
            frequency_unit: 'day',
            publish_at: null
        } as DripConfig;

        render(<SettingsDialog {...defaultProps} isOpen={true} dripConfig={dripConfig} />);

        expect(screen.getByText(/Every 1 day/)).toBeInTheDocument();
    });

    it('formats frequency text correctly for plural values', () => {
        const dripConfig = {
            is_drip_enabled: true,
            frequency_value: 3,
            frequency_unit: 'day',
            publish_at: null
        } as DripConfig;

        render(<SettingsDialog {...defaultProps} isOpen={true} dripConfig={dripConfig} />);

        expect(screen.getByText(/Every 3 days/)).toBeInTheDocument();
    });
}); 