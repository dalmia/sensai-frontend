import React from 'react';
import { render, waitFor } from '@testing-library/react';
import CohortPage from '@/app/school/admin/[id]/cohorts/[cohortId]/page';

// Mock Next.js navigation - redirect should throw to interrupt execution
jest.mock('next/navigation', () => ({
    redirect: jest.fn(() => {
        throw new Error('NEXT_REDIRECT');
    })
}));

// Mock the ClientCohortPage component
jest.mock('@/app/school/admin/[id]/cohorts/[cohortId]/ClientCohortPage', () => {
    return jest.fn(() => <div data-testid="client-cohort-page">Client Cohort Page</div>);
});

// Import the mocked functions to access them in tests
const { redirect } = require('next/navigation');
const mockClientCohortPage = require('@/app/school/admin/[id]/cohorts/[cohortId]/ClientCohortPage');

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = jest.fn();
});

afterAll(() => {
    console.error = originalConsoleError;
});

// Helper to render async server components
async function renderAsyncComponent(component: React.ReactElement) {
    const result = await component.type(component.props);
    return render(result);
}

describe('CohortPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Valid cohortId scenarios', () => {
        it('should render ClientCohortPage with correct props when cohortId is valid', async () => {
            const params = Promise.resolve({ id: 'school123', cohortId: 'cohort456' });

            const { getByTestId } = await renderAsyncComponent(<CohortPage params={params} />);

            expect(getByTestId('client-cohort-page')).toBeInTheDocument();
            expect(mockClientCohortPage).toHaveBeenCalledTimes(1);
            const [firstCallProps] = mockClientCohortPage.mock.calls[0];
            expect(firstCallProps).toEqual({
                schoolId: 'school123',
                cohortId: 'cohort456'
            });
            expect(redirect).not.toHaveBeenCalled();
        });

        it('should render ClientCohortPage when cohortId is a numeric string', async () => {
            const params = Promise.resolve({ id: '123', cohortId: '789' });

            const { getByTestId } = await renderAsyncComponent(<CohortPage params={params} />);

            expect(getByTestId('client-cohort-page')).toBeInTheDocument();
            expect(mockClientCohortPage).toHaveBeenCalledTimes(1);
            const [firstCallProps] = mockClientCohortPage.mock.calls[0];
            expect(firstCallProps).toEqual({
                schoolId: '123',
                cohortId: '789'
            });
            expect(redirect).not.toHaveBeenCalled();
        });

        it('should render ClientCohortPage when cohortId contains special characters', async () => {
            const params = Promise.resolve({ id: 'school-test', cohortId: 'cohort_123-abc' });

            const { getByTestId } = await renderAsyncComponent(<CohortPage params={params} />);

            expect(getByTestId('client-cohort-page')).toBeInTheDocument();
            expect(mockClientCohortPage).toHaveBeenCalledTimes(1);
            const [firstCallProps] = mockClientCohortPage.mock.calls[0];
            expect(firstCallProps).toEqual({
                schoolId: 'school-test',
                cohortId: 'cohort_123-abc'
            });
            expect(redirect).not.toHaveBeenCalled();
        });
    });

    describe('Invalid cohortId scenarios - redirects', () => {
        it('should redirect and log error when cohortId is undefined', async () => {
            const params = Promise.resolve({ id: 'school123', cohortId: undefined as any });

            await expect(renderAsyncComponent(<CohortPage params={params} />)).rejects.toThrow('NEXT_REDIRECT');

            expect(console.error).toHaveBeenCalledWith("Invalid cohortId in URL:", undefined);
            expect(redirect).toHaveBeenCalledWith('/school/admin/school123#cohorts');
            expect(mockClientCohortPage).not.toHaveBeenCalled();
        });

        it('should redirect and log error when cohortId is the string "undefined"', async () => {
            const params = Promise.resolve({ id: 'school456', cohortId: 'undefined' });

            await expect(renderAsyncComponent(<CohortPage params={params} />)).rejects.toThrow('NEXT_REDIRECT');

            expect(console.error).toHaveBeenCalledWith("Invalid cohortId in URL:", 'undefined');
            expect(redirect).toHaveBeenCalledWith('/school/admin/school456#cohorts');
            expect(mockClientCohortPage).not.toHaveBeenCalled();
        });

        it('should redirect when cohortId is an empty string', async () => {
            const params = Promise.resolve({ id: 'school789', cohortId: '' });

            await expect(renderAsyncComponent(<CohortPage params={params} />)).rejects.toThrow('NEXT_REDIRECT');

            expect(console.error).toHaveBeenCalledWith("Invalid cohortId in URL:", '');
            expect(redirect).toHaveBeenCalledWith('/school/admin/school789#cohorts');
            expect(mockClientCohortPage).not.toHaveBeenCalled();
        });

        it('should redirect when cohortId is null', async () => {
            const params = Promise.resolve({ id: 'school000', cohortId: null as any });

            await expect(renderAsyncComponent(<CohortPage params={params} />)).rejects.toThrow('NEXT_REDIRECT');

            expect(console.error).toHaveBeenCalledWith("Invalid cohortId in URL:", null);
            expect(redirect).toHaveBeenCalledWith('/school/admin/school000#cohorts');
            expect(mockClientCohortPage).not.toHaveBeenCalled();
        });

        it('should redirect when cohortId is false (falsy value)', async () => {
            const params = Promise.resolve({ id: 'school111', cohortId: false as any });

            await expect(renderAsyncComponent(<CohortPage params={params} />)).rejects.toThrow('NEXT_REDIRECT');

            expect(console.error).toHaveBeenCalledWith("Invalid cohortId in URL:", false);
            expect(redirect).toHaveBeenCalledWith('/school/admin/school111#cohorts');
            expect(mockClientCohortPage).not.toHaveBeenCalled();
        });
    });

    describe('Edge cases with school id', () => {
        it('should handle numeric school id correctly', async () => {
            const params = Promise.resolve({ id: '12345', cohortId: 'valid-cohort' });

            const { getByTestId } = await renderAsyncComponent(<CohortPage params={params} />);

            expect(getByTestId('client-cohort-page')).toBeInTheDocument();
            expect(mockClientCohortPage).toHaveBeenCalledTimes(1);
            const [firstCallProps] = mockClientCohortPage.mock.calls[0];
            expect(firstCallProps).toEqual({
                schoolId: '12345',
                cohortId: 'valid-cohort'
            });
        });

        it('should handle school id with special characters', async () => {
            const params = Promise.resolve({ id: 'school-test_123', cohortId: 'valid-cohort' });

            const { getByTestId } = await renderAsyncComponent(<CohortPage params={params} />);

            expect(getByTestId('client-cohort-page')).toBeInTheDocument();
            expect(mockClientCohortPage).toHaveBeenCalledTimes(1);
            const [firstCallProps] = mockClientCohortPage.mock.calls[0];
            expect(firstCallProps).toEqual({
                schoolId: 'school-test_123',
                cohortId: 'valid-cohort'
            });
        });

        it('should redirect correctly with complex school id', async () => {
            const params = Promise.resolve({ id: 'complex-school_123-test', cohortId: 'undefined' });

            await expect(renderAsyncComponent(<CohortPage params={params} />)).rejects.toThrow('NEXT_REDIRECT');

            expect(redirect).toHaveBeenCalledWith('/school/admin/complex-school_123-test#cohorts');
        });
    });

    describe('Component props verification', () => {
        it('should pass exact schoolId and cohortId values to ClientCohortPage', async () => {
            const params = Promise.resolve({ id: 'exact-school-id', cohortId: 'exact-cohort-id' });

            await renderAsyncComponent(<CohortPage params={params} />);

            expect(mockClientCohortPage).toHaveBeenCalledTimes(1);
            const [firstCallProps] = mockClientCohortPage.mock.calls[0];
            expect(firstCallProps).toEqual({
                schoolId: 'exact-school-id',
                cohortId: 'exact-cohort-id'
            });
        });

        it('should pass only schoolId and cohortId props to ClientCohortPage', async () => {
            const params = Promise.resolve({ id: 'school', cohortId: 'cohort' });

            await renderAsyncComponent(<CohortPage params={params} />);

            expect(mockClientCohortPage).toHaveBeenCalledTimes(1);
            const [firstCallProps] = mockClientCohortPage.mock.calls[0];
            expect(Object.keys(firstCallProps)).toEqual(['schoolId', 'cohortId']);
        });
    });

    describe('Console error logging', () => {
        it('should log error when cohortId is invalid', async () => {
            const params = Promise.resolve({ id: 'test', cohortId: undefined as any });

            await expect(renderAsyncComponent(<CohortPage params={params} />)).rejects.toThrow('NEXT_REDIRECT');

            expect(console.error).toHaveBeenCalledWith("Invalid cohortId in URL:", undefined);
        });

        it('should not log error when cohortId is valid', async () => {
            const params = Promise.resolve({ id: 'test', cohortId: 'valid' });

            await renderAsyncComponent(<CohortPage params={params} />);

            expect(console.error).not.toHaveBeenCalled();
        });
    });

    describe('Redirect URL format', () => {
        it('should include #cohorts fragment in redirect URL', async () => {
            const params = Promise.resolve({ id: 'test-school', cohortId: undefined as any });

            await expect(renderAsyncComponent(<CohortPage params={params} />)).rejects.toThrow('NEXT_REDIRECT');

            expect(redirect).toHaveBeenCalledWith('/school/admin/test-school#cohorts');
        });

        it('should preserve exact school id in redirect URL', async () => {
            const params = Promise.resolve({ id: 'very-specific-school-id-123', cohortId: '' });

            await expect(renderAsyncComponent(<CohortPage params={params} />)).rejects.toThrow('NEXT_REDIRECT');

            expect(redirect).toHaveBeenCalledWith('/school/admin/very-specific-school-id-123#cohorts');
        });
    });
});
