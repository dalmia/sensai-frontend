import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IntegrationProvider, useIntegration } from '../../context/IntegrationContext';

// Mock useAuth
const mockUser = { id: 'test-user-id' };

jest.mock('@/lib/auth', () => ({
    useAuth: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

// Mock window.location
const mockLocation = {
    href: 'http://localhost:3000',
    search: '',
    pathname: '/test'
};
Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true,
});

// Mock window.history
const mockHistory = {
    replaceState: jest.fn()
};
Object.defineProperty(window, 'history', {
    value: mockHistory,
    writable: true,
});

// Mock environment variables
process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:8000';
process.env.NEXT_PUBLIC_NOTION_CLIENT_ID = 'test-client-id';

// Test component to access context
const TestComponent = () => {
    const context = useIntegration();

    return (
        <div>
            <div data-testid="has-integration">{context.hasIntegration.toString()}</div>
            <div data-testid="is-loading">{context.isLoading.toString()}</div>
            <div data-testid="error">{context.error || 'null'}</div>
            <div data-testid="access-token">{context.accessToken || 'null'}</div>
            <div data-testid="pages-count">{context.pages.length}</div>
            <div data-testid="no-pages-found">{context.noPagesFound.toString()}</div>
            <div data-testid="show-dropdown">{context.showDropdown.toString()}</div>
            <div data-testid="is-connecting">{context.isConnecting.toString()}</div>
            <div data-testid="oauth-complete">{context.isOAuthCallbackComplete.toString()}</div>

            <button onClick={context.checkIntegration} data-testid="check-integration">
                Check Integration
            </button>
            <button onClick={context.fetchPages} data-testid="fetch-pages">
                Fetch Pages
            </button>
            <button onClick={context.connectIntegration} data-testid="connect-integration">
                Connect Integration
            </button>
            <button onClick={context.disconnectIntegration} data-testid="disconnect-integration">
                Disconnect Integration
            </button>
            <button onClick={() => context.setShowDropdown(true)} data-testid="show-dropdown-btn">
                Show Dropdown
            </button>
            <button onClick={() => context.setError('test error')} data-testid="set-error">
                Set Error
            </button>
        </div>
    );
};

describe('IntegrationContext', () => {
    const mockUseAuth = require('@/lib/auth').useAuth as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockLocation.search = '';
        mockLocation.href = 'http://localhost:3000';
        (global.fetch as jest.Mock).mockClear();
        mockUseAuth.mockReturnValue({ user: mockUser });

        // Default mock for fetch to prevent undefined response.ok errors
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            json: async () => ({})
        });
    });

    describe('useIntegration hook', () => {
        it('should throw error when used outside provider', () => {
            // Suppress console.error for this test
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            expect(() => {
                render(<TestComponent />);
            }).toThrow('useIntegration must be used within a IntegrationProvider');

            consoleSpy.mockRestore();
        });
    });

    describe('IntegrationProvider', () => {
        it('should provide initial state', async () => {
            // Mock successful integration check to avoid error state
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ([])
            });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            // Wait for useEffect to complete
            await waitFor(() => {
                expect(screen.getByTestId('has-integration')).toHaveTextContent('false');
            });

            expect(screen.getByTestId('error')).toHaveTextContent('null');
            expect(screen.getByTestId('access-token')).toHaveTextContent('null');
            expect(screen.getByTestId('pages-count')).toHaveTextContent('0');
            expect(screen.getByTestId('no-pages-found')).toHaveTextContent('false');
            expect(screen.getByTestId('show-dropdown')).toHaveTextContent('false');
            expect(screen.getByTestId('is-connecting')).toHaveTextContent('false');
            expect(screen.getByTestId('oauth-complete')).toHaveTextContent('false');
        });
    });

    describe('disconnectIntegration function', () => {
        it('should not proceed when user.id is missing', async () => {
            // Mock useAuth to return no user
            mockUseAuth.mockReturnValue({ user: null });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const disconnectBtn = screen.getByTestId('disconnect-integration');

            await act(async () => {
                disconnectBtn.click();
            });

            // Should not have called disconnect API (only initial check might have been called)
            const disconnectCalls = (global.fetch as jest.Mock).mock.calls.filter(call =>
                call[1]?.method === 'DELETE'
            );
            expect(disconnectCalls).toHaveLength(0);
        });

        it('should not proceed when accessToken is missing', async () => {
            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            // Wait for initial state
            await waitFor(() => {
                expect(screen.getByTestId('access-token')).toHaveTextContent('null');
            });

            const disconnectBtn = screen.getByTestId('disconnect-integration');

            await act(async () => {
                disconnectBtn.click();
            });

            // Should not have called disconnect API (only initial check)
            const disconnectCalls = (global.fetch as jest.Mock).mock.calls.filter(call =>
                call[1]?.method === 'DELETE'
            );
            expect(disconnectCalls).toHaveLength(0);
        });

        it('should successfully disconnect integration', async () => {
            // Reset mocks and setup specific responses
            (global.fetch as jest.Mock).mockClear();

            // Mock successful integration check first, then successful pages fetch, then successful disconnect
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ([{
                        integration_type: 'notion',
                        access_token: 'test-token'
                    }])
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ pages: [] })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({})
                });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            // Wait for initial integration check
            await waitFor(() => {
                expect(screen.getByTestId('has-integration')).toHaveTextContent('true');
            });

            const disconnectBtn = screen.getByTestId('disconnect-integration');

            await act(async () => {
                disconnectBtn.click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('has-integration')).toHaveTextContent('false');
                expect(screen.getByTestId('access-token')).toHaveTextContent('null');
                expect(screen.getByTestId('pages-count')).toHaveTextContent('0');
                expect(screen.getByTestId('show-dropdown')).toHaveTextContent('false');
                expect(screen.getByTestId('error')).toHaveTextContent('null');
                expect(screen.getByTestId('no-pages-found')).toHaveTextContent('false');
            });

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:8000/integrations/',
                {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: 'test-user-id',
                        integration_type: 'notion',
                    }),
                }
            );
        });

        it('should handle disconnect API failure', async () => {
            // Mock successful integration check first
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ([{
                        integration_type: 'notion',
                        access_token: 'test-token'
                    }])
                })
                // Mock failed disconnect
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500
                });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            // Wait for initial integration check
            await waitFor(() => {
                expect(screen.getByTestId('has-integration')).toHaveTextContent('true');
            });

            const disconnectBtn = screen.getByTestId('disconnect-integration');

            await act(async () => {
                disconnectBtn.click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('error')).toHaveTextContent('Failed to disconnect Integration');
            });
        });

        it('should handle disconnect network error', async () => {
            // Mock successful integration check first
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ([{
                        integration_type: 'notion',
                        access_token: 'test-token'
                    }])
                })
                // Mock network error
                .mockRejectedValueOnce(new Error('Network error'));

            // Suppress console.error for this test
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            // Wait for initial integration check
            await waitFor(() => {
                expect(screen.getByTestId('has-integration')).toHaveTextContent('true');
            });

            const disconnectBtn = screen.getByTestId('disconnect-integration');

            await act(async () => {
                disconnectBtn.click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('error')).toHaveTextContent('Failed to disconnect Integration');
            });

            consoleSpy.mockRestore();
        });

        it('should trigger catch block error in disconnectIntegration', async () => {
            // Mock successful integration check first
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ([{
                        integration_type: 'notion',
                        access_token: 'test-token'
                    }])
                })
                // Mock successful pages fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ pages: [] })
                })
                // Mock network error on disconnect - this will trigger the catch block
                .mockRejectedValueOnce(new Error('Network error'));

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            // Wait for initial integration check
            await waitFor(() => {
                expect(screen.getByTestId('has-integration')).toHaveTextContent('true');
            });

            const disconnectBtn = screen.getByTestId('disconnect-integration');

            await act(async () => {
                disconnectBtn.click();
            });

            // This should trigger the catch block and set the error message
            await waitFor(() => {
                expect(screen.getByTestId('error')).toHaveTextContent('Failed to disconnect Integration');
            });
        });
    });

    describe('OAuth callback handling', () => {
        it('should not process OAuth callback when user.id is missing', async () => {
            // Mock useAuth to return no user
            mockUseAuth.mockReturnValue({ user: null });

            // Set OAuth callback parameters
            mockLocation.search = '?access_token=test-oauth-token';

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            // Should not make any API calls for OAuth callback
            const createIntegrationCalls = (global.fetch as jest.Mock).mock.calls.filter(call =>
                call[1]?.method === 'POST'
            );
            expect(createIntegrationCalls).toHaveLength(0);
        });

        it('should process OAuth callback successfully', async () => {
            // Set OAuth callback parameters
            mockLocation.search = '?access_token=test-oauth-token';

            // Mock successful integration creation and check
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({})
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ([{
                        integration_type: 'notion',
                        access_token: 'test-oauth-token'
                    }])
                });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('oauth-complete')).toHaveTextContent('true');
            });

            // Should have called create integration API
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:8000/integrations/',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: 'test-user-id',
                        integration_type: 'notion',
                        access_token: 'test-oauth-token',
                    }),
                }
            );

            // Should have cleared URL parameters
            expect(mockHistory.replaceState).toHaveBeenCalled();
        });

        it('should handle OAuth callback creation failure', async () => {
            // Set OAuth callback parameters
            mockLocation.search = '?access_token=test-oauth-token';

            // Mock failed integration creation
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            // Suppress console.error for this test
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('error')).toHaveTextContent('Failed to create integration');
            });

            consoleSpy.mockRestore();
        });

        it('should handle OAuth callback network error', async () => {
            // Set OAuth callback parameters
            mockLocation.search = '?access_token=test-oauth-token';

            // Mock network error
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            // Suppress console.error for this test
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('error')).toHaveTextContent('Failed to create integration');
            });

            consoleSpy.mockRestore();
        });
    });

    describe('Context actions', () => {
        it('should handle setShowDropdown action', async () => {
            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const showDropdownBtn = screen.getByTestId('show-dropdown-btn');

            await act(async () => {
                showDropdownBtn.click();
            });

            expect(screen.getByTestId('show-dropdown')).toHaveTextContent('true');
        });

        it('should handle setError action', async () => {
            // Mock successful integration check to avoid error state
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ([])
            });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            // Wait for initial load to complete
            await waitFor(() => {
                expect(screen.getByTestId('has-integration')).toHaveTextContent('false');
            });

            const setErrorBtn = screen.getByTestId('set-error');

            await act(async () => {
                setErrorBtn.click();
            });

            expect(screen.getByTestId('error')).toHaveTextContent('test error');
        });
    });

    describe('connectIntegration function', () => {
        it('should not proceed when user.id is missing', async () => {
            // Mock useAuth to return no user
            mockUseAuth.mockReturnValue({ user: null });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const connectBtn = screen.getByTestId('connect-integration');

            await act(async () => {
                connectBtn.click();
            });

            // Should not redirect (href remains unchanged)
            expect(mockLocation.href).toBe('http://localhost:3000');
        });

        it('should redirect to Notion OAuth URL', async () => {
            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const connectBtn = screen.getByTestId('connect-integration');

            await act(async () => {
                connectBtn.click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('is-connecting')).toHaveTextContent('true');
            });

            // Should have set window.location.href to Notion OAuth URL
            expect(mockLocation.href).toContain('https://api.notion.com/v1/oauth/authorize');
            expect(mockLocation.href).toContain('client_id=test-client-id');
            expect(mockLocation.href).toContain('response_type=code');
        });
    });

    describe('fetchPages function', () => {
        it('should handle successful pages fetch with no pages', async () => {
            // Mock successful integration check first, then successful empty pages fetch
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ([{
                        integration_type: 'notion',
                        access_token: 'test-token'
                    }])
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ pages: [] })
                });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            // Wait for integration check and pages fetch
            await waitFor(() => {
                expect(screen.getByTestId('has-integration')).toHaveTextContent('true');
                expect(screen.getByTestId('no-pages-found')).toHaveTextContent('true');
            });
        });

        it('should handle pages fetch API error', async () => {
            // Mock successful integration check first, then failed pages fetch
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ([{
                        integration_type: 'notion',
                        access_token: 'test-token'
                    }])
                })
                .mockResolvedValueOnce({
                    ok: false,
                    json: async () => ({ error: 'Pages fetch failed' })
                });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            // Wait for integration check and pages fetch error
            await waitFor(() => {
                expect(screen.getByTestId('has-integration')).toHaveTextContent('true');
                expect(screen.getByTestId('error')).toHaveTextContent('Pages fetch failed');
                expect(screen.getByTestId('no-pages-found')).toHaveTextContent('true');
            });
        });
    });

    describe('Edge cases and specific line coverage', () => {
        it('should handle successful disconnect with proper state reset', async () => {
            // Test lines 156-163 (successful disconnect response handling)
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ([{
                        integration_type: 'notion',
                        access_token: 'test-token'
                    }])
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ pages: [{ id: 'page1', properties: { title: { title: [{ plain_text: 'Test Page' }] } } }] })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({})
                });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            // Wait for integration and pages to load
            await waitFor(() => {
                expect(screen.getByTestId('has-integration')).toHaveTextContent('true');
                expect(screen.getByTestId('pages-count')).toHaveTextContent('1');
                expect(screen.getByTestId('show-dropdown')).toHaveTextContent('true');
            });

            const disconnectBtn = screen.getByTestId('disconnect-integration');

            await act(async () => {
                disconnectBtn.click();
            });

            // Verify all state is properly reset (lines 156-161)
            await waitFor(() => {
                expect(screen.getByTestId('has-integration')).toHaveTextContent('false');
                expect(screen.getByTestId('access-token')).toHaveTextContent('null');
                expect(screen.getByTestId('pages-count')).toHaveTextContent('0');
                expect(screen.getByTestId('show-dropdown')).toHaveTextContent('false');
                expect(screen.getByTestId('error')).toHaveTextContent('null');
                expect(screen.getByTestId('no-pages-found')).toHaveTextContent('false');
            });
        });

    });
});
