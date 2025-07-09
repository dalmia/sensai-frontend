import React from 'react';
import { render, waitFor } from '@testing-library/react';
import LeaderboardPage, { metadata } from '@/app/school/[id]/cohort/[cohortId]/leaderboard/page';

// Mock Next.js cookies
jest.mock('next/headers', () => ({
    cookies: jest.fn(() => ({
        toString: jest.fn(() => 'mock-cookie-string')
    }))
}));

// Mock the ClientLeaderboardView component
jest.mock('@/app/school/[id]/cohort/[cohortId]/leaderboard/ClientLeaderboardView', () => {
    return jest.fn(() => <div data-testid="client-leaderboard-view">Client Leaderboard View</div>);
});

// Import the mocked functions to access them in tests
const { cookies } = require('next/headers');
const mockClientLeaderboardView = require('@/app/school/[id]/cohort/[cohortId]/leaderboard/ClientLeaderboardView');

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = jest.fn();
});

afterAll(() => {
    console.error = originalConsoleError;
});

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
    process.env = {
        ...originalEnv,
        BACKEND_URL: 'https://test-backend.com'
    };
});

afterAll(() => {
    process.env = originalEnv;
});

describe('LeaderboardPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Metadata export', () => {
        it('should export correct metadata', () => {
            expect(metadata).toEqual({
                title: 'Leaderboard',
                description: 'View the performance of all members in this cohort.'
            });
        });

        it('should have static metadata properties', () => {
            expect(metadata.title).toBe('Leaderboard');
            expect(metadata.description).toBe('View the performance of all members in this cohort.');
        });
    });

    describe('getCohortName function', () => {
        it('should fetch cohort name successfully', async () => {
            const mockCohortData = { name: 'Test Cohort' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(mockCohortData)
            });

            const params = { id: 'school123', cohortId: 'cohort456' };
            const { getByTestId } = render(await LeaderboardPage({ params, searchParams: {} }));

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-backend.com/cohorts/cohort456',
                {
                    headers: {
                        Cookie: 'mock-cookie-string'
                    }
                }
            );
            expect(getByTestId('client-leaderboard-view')).toBeInTheDocument();
            expect(mockClientLeaderboardView).toHaveBeenCalledWith(
                {
                    cohortId: 'cohort456',
                    cohortName: 'Test Cohort',
                    view: 'learner',
                    batchId: null
                },
                undefined
            );
        });

        it('should handle failed cohort fetch (non-ok response)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            const params = { id: 'school123', cohortId: 'invalid-cohort' };
            const { getByTestId } = render(await LeaderboardPage({ params, searchParams: {} }));

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-backend.com/cohorts/invalid-cohort',
                {
                    headers: {
                        Cookie: 'mock-cookie-string'
                    }
                }
            );
            expect(getByTestId('client-leaderboard-view')).toBeInTheDocument();
            expect(mockClientLeaderboardView).toHaveBeenCalledWith(
                {
                    cohortId: 'invalid-cohort',
                    cohortName: null,
                    view: 'learner',
                    batchId: null
                },
                undefined
            );
        });

        it('should handle network errors when fetching cohort', async () => {
            const networkError = new Error('Network error');
            mockFetch.mockRejectedValueOnce(networkError);

            const params = { id: 'school123', cohortId: 'cohort456' };
            const { getByTestId } = render(await LeaderboardPage({ params, searchParams: {} }));

            expect(console.error).toHaveBeenCalledWith('Error fetching cohort name:', networkError);
            expect(getByTestId('client-leaderboard-view')).toBeInTheDocument();
            expect(mockClientLeaderboardView).toHaveBeenCalledWith(
                {
                    cohortId: 'cohort456',
                    cohortName: null,
                    view: 'learner',
                    batchId: null
                },
                undefined
            );
        });

        it('should handle JSON parsing errors', async () => {
            const jsonError = new Error('Invalid JSON');
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockRejectedValue(jsonError)
            });

            const params = { id: 'school123', cohortId: 'cohort456' };
            const { getByTestId } = render(await LeaderboardPage({ params, searchParams: {} }));

            expect(console.error).toHaveBeenCalledWith('Error fetching cohort name:', jsonError);
            expect(getByTestId('client-leaderboard-view')).toBeInTheDocument();
            expect(mockClientLeaderboardView).toHaveBeenCalledWith(
                {
                    cohortId: 'cohort456',
                    cohortName: null,
                    view: 'learner',
                    batchId: null
                },
                undefined
            );
        });
    });

    describe('LeaderboardPage component', () => {
        it('should render ClientLeaderboardView with correct props when cohort fetch succeeds', async () => {
            const mockCohortData = { name: 'Advanced React Cohort' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(mockCohortData)
            });

            const params = { id: 'school789', cohortId: 'cohort123' };
            const { getByTestId } = render(await LeaderboardPage({ params, searchParams: {} }));

            expect(getByTestId('client-leaderboard-view')).toBeInTheDocument();
            expect(mockClientLeaderboardView).toHaveBeenCalledTimes(1);
            expect(mockClientLeaderboardView).toHaveBeenCalledWith(
                {
                    cohortId: 'cohort123',
                    cohortName: 'Advanced React Cohort',
                    view: 'learner',
                    batchId: null
                },
                undefined
            );
        });

        it('should render ClientLeaderboardView with null cohortName when fetch fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            const params = { id: 'school789', cohortId: 'cohort123' };
            const { getByTestId } = render(await LeaderboardPage({ params, searchParams: {} }));

            expect(getByTestId('client-leaderboard-view')).toBeInTheDocument();
            expect(mockClientLeaderboardView).toHaveBeenCalledWith(
                {
                    cohortId: 'cohort123',
                    cohortName: null,
                    view: 'learner',
                    batchId: null
                },
                undefined
            );
        });

        it('should always pass view as "learner"', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'Test Cohort' })
            });

            const params = { id: 'any-school', cohortId: 'any-cohort' };
            render(await LeaderboardPage({ params, searchParams: {} }));

            expect(mockClientLeaderboardView).toHaveBeenCalledWith(
                expect.objectContaining({
                    view: 'learner'
                }),
                undefined
            );
        });
    });

    describe('Parameter handling', () => {
        it('should handle different cohort ID formats', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'Numeric Cohort' })
            });

            const params = { id: '123', cohortId: '456' };
            render(await LeaderboardPage({ params, searchParams: {} }));

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-backend.com/cohorts/456',
                expect.any(Object)
            );
            expect(mockClientLeaderboardView).toHaveBeenCalledWith(
                expect.objectContaining({
                    cohortId: '456'
                }),
                undefined
            );
        });

        it('should handle UUID cohort IDs', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'UUID Cohort' })
            });

            const params = { id: 'school-abc', cohortId: 'cohort-uuid-123-456' };
            render(await LeaderboardPage({ params, searchParams: {} }));

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-backend.com/cohorts/cohort-uuid-123-456',
                expect.any(Object)
            );
            expect(mockClientLeaderboardView).toHaveBeenCalledWith(
                expect.objectContaining({
                    cohortId: 'cohort-uuid-123-456'
                }),
                undefined
            );
        });

        it('should handle special characters in cohort ID', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'Special Cohort' })
            });

            const params = { id: 'school-test', cohortId: 'cohort_123-abc' };
            render(await LeaderboardPage({ params, searchParams: {} }));

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-backend.com/cohorts/cohort_123-abc',
                expect.any(Object)
            );
        });

        it('should parse batchId from searchParams', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'Test Cohort' })
            });

            const params = { id: 'school123', cohortId: 'cohort456' };
            const searchParams = { batchId: '789' };
            render(await LeaderboardPage({ params, searchParams }));

            expect(mockClientLeaderboardView).toHaveBeenCalledWith(
                expect.objectContaining({
                    batchId: 789
                }),
                undefined
            );
        });

        it('should handle invalid batchId in searchParams', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'Test Cohort' })
            });

            const params = { id: 'school123', cohortId: 'cohort456' };
            const searchParams = { batchId: 'invalid' };
            render(await LeaderboardPage({ params, searchParams }));

            expect(mockClientLeaderboardView).toHaveBeenCalledWith(
                expect.objectContaining({
                    batchId: null
                }),
                undefined
            );
        });
    });

    describe('Cookie handling', () => {
        it('should use cookies in fetch request headers', async () => {
            const mockCookieString = 'session=abc123; theme=dark';
            cookies.mockReturnValue({
                toString: jest.fn().mockReturnValue(mockCookieString)
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'Cookie Test Cohort' })
            });

            const params = { id: 'school123', cohortId: 'cohort456' };
            await LeaderboardPage({ params, searchParams: {} });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-backend.com/cohorts/cohort456',
                {
                    headers: {
                        Cookie: mockCookieString
                    }
                }
            );
        });

        it('should call cookies().toString() to get cookie string', async () => {
            const mockToString = jest.fn().mockReturnValue('test-cookies');
            cookies.mockReturnValue({
                toString: mockToString
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'Test' })
            });

            const params = { id: 'school', cohortId: 'cohort' };
            await LeaderboardPage({ params, searchParams: {} });

            expect(cookies).toHaveBeenCalledTimes(1);
            expect(mockToString).toHaveBeenCalledTimes(1);
        });
    });

    describe('Component structure and props', () => {
        it('should render only ClientLeaderboardView component', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'Test Cohort' })
            });

            const params = { id: 'school', cohortId: 'cohort' };
            const { container } = render(await LeaderboardPage({ params, searchParams: {} }));

            expect(container.children).toHaveLength(1);
            expect(container.querySelector('[data-testid="client-leaderboard-view"]')).toBeInTheDocument();
        });

        it('should pass exactly four props to ClientLeaderboardView', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'Test Cohort' })
            });

            const params = { id: 'school', cohortId: 'cohort' };
            render(await LeaderboardPage({ params, searchParams: {} }));

            expect(mockClientLeaderboardView).toHaveBeenCalledTimes(1);
            const [props] = mockClientLeaderboardView.mock.calls[0];
            expect(Object.keys(props)).toEqual(['cohortId', 'cohortName', 'view', 'batchId']);
        });

        it('should have correct prop types passed to ClientLeaderboardView', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'Test Cohort' })
            });

            const params = { id: 'school', cohortId: 'cohort' };
            render(await LeaderboardPage({ params, searchParams: {} }));

            const [props] = mockClientLeaderboardView.mock.calls[0];
            expect(typeof props.cohortId).toBe('string');
            expect(typeof props.cohortName).toBe('string');
            expect(typeof props.view).toBe('string');
            expect(props.view).toBe('learner');
            expect(props.batchId === null || typeof props.batchId === 'number').toBe(true);
        });
    });

    describe('Environment variable usage', () => {
        it('should use BACKEND_URL environment variable', async () => {
            process.env.BACKEND_URL = 'https://custom-backend.example.com';

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'Test' })
            });

            const params = { id: 'school', cohortId: 'test-cohort' };
            render(await LeaderboardPage({ params, searchParams: {} }));

            expect(mockFetch).toHaveBeenCalledWith(
                'https://custom-backend.example.com/cohorts/test-cohort',
                expect.any(Object)
            );
        });
    });

    describe('Error logging', () => {
        it('should log errors when fetch fails', async () => {
            const fetchError = new Error('Fetch failed');
            mockFetch.mockRejectedValueOnce(fetchError);

            const params = { id: 'school', cohortId: 'cohort' };
            render(await LeaderboardPage({ params, searchParams: {} }));

            expect(console.error).toHaveBeenCalledWith('Error fetching cohort name:', fetchError);
        });

        it('should not log errors when fetch succeeds', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'Success Cohort' })
            });

            const params = { id: 'school', cohortId: 'cohort' };
            render(await LeaderboardPage({ params, searchParams: {} }));

            expect(console.error).not.toHaveBeenCalled();
        });
    });
}); 