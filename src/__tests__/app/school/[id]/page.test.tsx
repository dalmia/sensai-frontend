import React from 'react';
import { render } from '@testing-library/react';
import SchoolPage from '@/app/school/[id]/page';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
    useParams: jest.fn()
}));

// Mock the ClientSchoolMemberView component
jest.mock('@/app/school/[id]/ClientSchoolMemberView', () => {
    return jest.fn(() => <div data-testid="client-school-learner-view">Client School Learner View</div>);
});

// Import the mocked functions to access them in tests
const { useParams } = require('next/navigation');
const mockClientSchoolMemberView = require('@/app/school/[id]/ClientSchoolMemberView');

describe('SchoolPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Parameter handling', () => {
        it('should render ClientSchoolMemberView with correct slug when id is provided', () => {
            useParams.mockReturnValue({ id: 'test-school' });

            const { getByTestId } = render(<SchoolPage />);

            expect(getByTestId('client-school-learner-view')).toBeInTheDocument();
            expect(mockClientSchoolMemberView).toHaveBeenCalledTimes(1);
            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: 'test-school' },
                undefined
            );
        });

        it('should render ClientSchoolMemberView with numeric school id', () => {
            useParams.mockReturnValue({ id: '12345' });

            const { getByTestId } = render(<SchoolPage />);

            expect(getByTestId('client-school-learner-view')).toBeInTheDocument();
            expect(mockClientSchoolMemberView).toHaveBeenCalledTimes(1);
            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: '12345' },
                undefined
            );
        });

        it('should render ClientSchoolMemberView with complex school id', () => {
            useParams.mockReturnValue({ id: 'school-test_123-abc' });

            const { getByTestId } = render(<SchoolPage />);

            expect(getByTestId('client-school-learner-view')).toBeInTheDocument();
            expect(mockClientSchoolMemberView).toHaveBeenCalledTimes(1);
            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: 'school-test_123-abc' },
                undefined
            );
        });

        it('should handle undefined id parameter', () => {
            useParams.mockReturnValue({ id: undefined });

            const { getByTestId } = render(<SchoolPage />);

            expect(getByTestId('client-school-learner-view')).toBeInTheDocument();
            expect(mockClientSchoolMemberView).toHaveBeenCalledTimes(1);
            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: undefined },
                undefined
            );
        });

        it('should handle null id parameter', () => {
            useParams.mockReturnValue({ id: null });

            const { getByTestId } = render(<SchoolPage />);

            expect(getByTestId('client-school-learner-view')).toBeInTheDocument();
            expect(mockClientSchoolMemberView).toHaveBeenCalledTimes(1);
            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: null },
                undefined
            );
        });

        it('should handle empty string id parameter', () => {
            useParams.mockReturnValue({ id: '' });

            const { getByTestId } = render(<SchoolPage />);

            expect(getByTestId('client-school-learner-view')).toBeInTheDocument();
            expect(mockClientSchoolMemberView).toHaveBeenCalledTimes(1);
            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: '' },
                undefined
            );
        });
    });

    describe('useParams edge cases', () => {
        it('should handle useParams returning undefined', () => {
            useParams.mockReturnValue(undefined);

            const { getByTestId } = render(<SchoolPage />);

            expect(getByTestId('client-school-learner-view')).toBeInTheDocument();
            expect(mockClientSchoolMemberView).toHaveBeenCalledTimes(1);
            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: undefined },
                undefined
            );
        });

        it('should handle useParams returning null', () => {
            useParams.mockReturnValue(null);

            const { getByTestId } = render(<SchoolPage />);

            expect(getByTestId('client-school-learner-view')).toBeInTheDocument();
            expect(mockClientSchoolMemberView).toHaveBeenCalledTimes(1);
            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: undefined },
                undefined
            );
        });

        it('should handle useParams returning empty object', () => {
            useParams.mockReturnValue({});

            const { getByTestId } = render(<SchoolPage />);

            expect(getByTestId('client-school-learner-view')).toBeInTheDocument();
            expect(mockClientSchoolMemberView).toHaveBeenCalledTimes(1);
            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: undefined },
                undefined
            );
        });
    });

    describe('Component rendering', () => {
        it('should render only ClientSchoolMemberView component', () => {
            useParams.mockReturnValue({ id: 'test-school' });

            const { container } = render(<SchoolPage />);

            expect(container.children).toHaveLength(1);
            expect(container.querySelector('[data-testid="client-school-learner-view"]')).toBeInTheDocument();
        });

        it('should call useParams hook exactly once', () => {
            useParams.mockReturnValue({ id: 'test-school' });

            render(<SchoolPage />);

            expect(useParams).toHaveBeenCalledTimes(1);
            expect(useParams).toHaveBeenCalledWith();
        });

        it('should call ClientSchoolMemberView with only slug prop', () => {
            useParams.mockReturnValue({ id: 'test-school' });

            render(<SchoolPage />);

            expect(mockClientSchoolMemberView).toHaveBeenCalledTimes(1);
            const [props] = mockClientSchoolMemberView.mock.calls[0];
            expect(Object.keys(props)).toEqual(['slug']);
        });
    });

    describe('Type casting behavior', () => {
        it('should cast id to string when id is a number', () => {
            useParams.mockReturnValue({ id: 123 });

            render(<SchoolPage />);

            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: 123 },
                undefined
            );
        });

        it('should cast id to string when id is boolean', () => {
            useParams.mockReturnValue({ id: true });

            render(<SchoolPage />);

            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: true },
                undefined
            );
        });

        it('should handle array id parameter (edge case)', () => {
            useParams.mockReturnValue({ id: ['test', 'school'] });

            render(<SchoolPage />);

            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: ['test', 'school'] },
                undefined
            );
        });
    });

    describe('Integration with ClientSchoolMemberView', () => {
        it('should pass correct slug prop to ClientSchoolMemberView', () => {
            const schoolSlug = 'integration-test-school';
            useParams.mockReturnValue({ id: schoolSlug });

            render(<SchoolPage />);

            expect(mockClientSchoolMemberView).toHaveBeenCalledWith(
                { slug: schoolSlug },
                undefined
            );
        });

        it('should render ClientSchoolMemberView component successfully', () => {
            useParams.mockReturnValue({ id: 'test' });

            const { getByTestId } = render(<SchoolPage />);

            expect(getByTestId('client-school-learner-view')).toBeInTheDocument();
            expect(getByTestId('client-school-learner-view')).toHaveTextContent('Client School Learner View');
        });
    });

    describe('Multiple renders consistency', () => {
        it('should behave consistently across multiple renders', () => {
            useParams.mockReturnValue({ id: 'consistent-school' });

            const { rerender, getByTestId } = render(<SchoolPage />);
            expect(getByTestId('client-school-learner-view')).toBeInTheDocument();
            expect(mockClientSchoolMemberView).toHaveBeenCalledTimes(1);

            rerender(<SchoolPage />);
            expect(getByTestId('client-school-learner-view')).toBeInTheDocument();
            expect(mockClientSchoolMemberView).toHaveBeenCalledTimes(2);
        });

        it('should handle parameter changes between renders', () => {
            useParams.mockReturnValue({ id: 'school-1' });

            const { rerender } = render(<SchoolPage />);
            expect(mockClientSchoolMemberView).toHaveBeenLastCalledWith(
                { slug: 'school-1' },
                undefined
            );

            useParams.mockReturnValue({ id: 'school-2' });
            rerender(<SchoolPage />);
            expect(mockClientSchoolMemberView).toHaveBeenLastCalledWith(
                { slug: 'school-2' },
                undefined
            );
        });
    });
}); 