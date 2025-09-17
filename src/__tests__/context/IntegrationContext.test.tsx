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

// Mock window.open
const mockWindowOpen = jest.fn().mockReturnValue({
    close: jest.fn()
});
Object.defineProperty(window, 'open', {
    value: mockWindowOpen,
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
        mockWindowOpen.mockClear();
        mockUseAuth.mockReturnValue({
            user: mockUser,
            isAuthenticated: true,
            isLoading: false
        });

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
            mockUseAuth.mockReturnValue({
                user: null,
                isAuthenticated: false,
                isLoading: false
            });

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
            // Mock successful integration check and pages fetch to avoid error state
            (global.fetch as jest.Mock).mockImplementation((url) => {
                if (url.includes('integrations') && url.includes('user_id=')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ([])
                    });
                }
                if (url.includes('fetchPages')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({ pages: [] })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: async () => ({})
                });
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
            mockUseAuth.mockReturnValue({
                user: null,
                isAuthenticated: false,
                isLoading: false
            });

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

        it('should open Notion OAuth URL in popup', async () => {
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

            // Should have opened Notion OAuth URL in popup
            expect(mockWindowOpen).toHaveBeenCalledWith(
                expect.stringContaining('https://api.notion.com/v1/oauth/authorize'),
                'notion-auth',
                'width=600,height=700,scrollbars=yes,resizable=yes'
            );
        });

        it('should handle popup blocked error', async () => {
            // Mock window.open to return null (popup blocked)
            const originalOpen = window.open;
            Object.defineProperty(window, 'open', {
                value: jest.fn().mockReturnValue(null),
                writable: true,
            });

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
                expect(screen.getByTestId('error')).toHaveTextContent('Please allow popups for this site to connect to Notion');
                expect(screen.getByTestId('is-connecting')).toHaveTextContent('false');
            });

            // Restore original window.open
            Object.defineProperty(window, 'open', {
                value: originalOpen,
                writable: true,
            });
        });
    });

    describe('messageListener in connectIntegration', () => {
        let mockAddEventListener: jest.SpyInstance;
        let mockRemoveEventListener: jest.SpyInstance;
        let mockPostMessage: jest.SpyInstance;

        beforeEach(() => {
            mockAddEventListener = jest.spyOn(window, 'addEventListener');
            mockRemoveEventListener = jest.spyOn(window, 'removeEventListener');
            mockPostMessage = jest.spyOn(window, 'postMessage');
        });

        afterEach(() => {
            mockAddEventListener.mockRestore();
            mockRemoveEventListener.mockRestore();
            mockPostMessage.mockRestore();
        });

        it('should ignore messages from different origins', async () => {
            // Mock successful integration creation
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ({})
            });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const connectBtn = screen.getByTestId('connect-integration');

            await act(async () => {
                connectBtn.click();
            });

            // Get the message listener that was added
            expect(mockAddEventListener).toHaveBeenCalledWith('message', expect.any(Function));
            const messageListener = mockAddEventListener.mock.calls.find(
                call => call[0] === 'message'
            )?.[1];

            // Simulate message from different origin
            const mockEvent = {
                origin: 'https://malicious-site.com',
                data: { type: 'NOTION_AUTH_SUCCESS', accessToken: 'fake-token' }
            } as MessageEvent;

            // Call the listener directly
            messageListener(mockEvent);

            // Should not have called handleAuthSuccess or removed listener
            expect(mockRemoveEventListener).not.toHaveBeenCalled();
            expect(screen.getByTestId('has-integration')).toHaveTextContent('false');
        });

        it('should handle NOTION_AUTH_SUCCESS message', async () => {
            // Mock successful integration creation
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ({})
            });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const connectBtn = screen.getByTestId('connect-integration');

            await act(async () => {
                connectBtn.click();
            });

            // Get the message listener that was added
            const messageListener = mockAddEventListener.mock.calls.find(
                call => call[0] === 'message'
            )?.[1];

            // Simulate successful auth message from same origin
            const mockEvent = {
                origin: window.location.origin,
                data: { type: 'NOTION_AUTH_SUCCESS', accessToken: 'test-token-123' }
            } as MessageEvent;

            // Call the listener directly
            await act(async () => {
                messageListener(mockEvent);
            });

            // Should have called handleAuthSuccess and removed listener
            await waitFor(() => {
                expect(screen.getByTestId('has-integration')).toHaveTextContent('true');
                expect(screen.getByTestId('access-token')).toHaveTextContent('test-token-123');
                expect(screen.getByTestId('is-connecting')).toHaveTextContent('false');
            });

            expect(mockRemoveEventListener).toHaveBeenCalledWith('message', messageListener);
        });

        it('should handle NOTION_AUTH_ERROR message with error', async () => {
            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const connectBtn = screen.getByTestId('connect-integration');

            await act(async () => {
                connectBtn.click();
            });

            // Get the message listener that was added
            const messageListener = mockAddEventListener.mock.calls.find(
                call => call[0] === 'message'
            )?.[1];

            // Simulate error auth message from same origin
            const mockEvent = {
                origin: window.location.origin,
                data: { type: 'NOTION_AUTH_ERROR', error: 'User cancelled authorization' }
            } as MessageEvent;

            // Call the listener directly
            await act(async () => {
                messageListener(mockEvent);
            });

            // Should have set error and removed listener
            await waitFor(() => {
                expect(screen.getByTestId('error')).toHaveTextContent('User cancelled authorization');
                expect(screen.getByTestId('is-connecting')).toHaveTextContent('false');
            });

            expect(mockRemoveEventListener).toHaveBeenCalledWith('message', messageListener);
        });

        it('should handle NOTION_AUTH_ERROR message without error (fallback)', async () => {
            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const connectBtn = screen.getByTestId('connect-integration');

            await act(async () => {
                connectBtn.click();
            });

            // Get the message listener that was added
            const messageListener = mockAddEventListener.mock.calls.find(
                call => call[0] === 'message'
            )?.[1];

            // Simulate error auth message from same origin without error field
            const mockEvent = {
                origin: window.location.origin,
                data: { type: 'NOTION_AUTH_ERROR' }
            } as MessageEvent;

            // Call the listener directly
            await act(async () => {
                messageListener(mockEvent);
            });

            // Should have set default error and removed listener
            await waitFor(() => {
                expect(screen.getByTestId('error')).toHaveTextContent('Authentication failed');
                expect(screen.getByTestId('is-connecting')).toHaveTextContent('false');
            });

            expect(mockRemoveEventListener).toHaveBeenCalledWith('message', messageListener);
        });

        it('should ignore unknown message types', async () => {
            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const connectBtn = screen.getByTestId('connect-integration');

            await act(async () => {
                connectBtn.click();
            });

            // Get the message listener that was added
            const messageListener = mockAddEventListener.mock.calls.find(
                call => call[0] === 'message'
            )?.[1];

            // Simulate unknown message type from same origin
            const mockEvent = {
                origin: window.location.origin,
                data: { type: 'UNKNOWN_MESSAGE_TYPE', someData: 'test' }
            } as MessageEvent;

            // Call the listener directly
            messageListener(mockEvent);

            // Should not have changed state or removed listener
            expect(screen.getByTestId('has-integration')).toHaveTextContent('false');
            expect(screen.getByTestId('error')).toHaveTextContent('null');
            expect(screen.getByTestId('is-connecting')).toHaveTextContent('true');
            expect(mockRemoveEventListener).not.toHaveBeenCalled();
        });

        it('should close popup on successful auth', async () => {
            const mockPopup = {
                close: jest.fn()
            };
            mockWindowOpen.mockReturnValue(mockPopup);

            // Mock successful integration creation
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ({})
            });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const connectBtn = screen.getByTestId('connect-integration');

            await act(async () => {
                connectBtn.click();
            });

            // Get the message listener that was added
            const messageListener = mockAddEventListener.mock.calls.find(
                call => call[0] === 'message'
            )?.[1];

            // Simulate successful auth message
            const mockEvent = {
                origin: window.location.origin,
                data: { type: 'NOTION_AUTH_SUCCESS', accessToken: 'test-token-123' }
            } as MessageEvent;

            // Call the listener directly
            await act(async () => {
                messageListener(mockEvent);
            });

            // Should have closed the popup
            expect(mockPopup.close).toHaveBeenCalled();
        });

        it('should close popup on auth error', async () => {
            const mockPopup = {
                close: jest.fn()
            };
            mockWindowOpen.mockReturnValue(mockPopup);

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const connectBtn = screen.getByTestId('connect-integration');

            await act(async () => {
                connectBtn.click();
            });

            // Get the message listener that was added
            const messageListener = mockAddEventListener.mock.calls.find(
                call => call[0] === 'message'
            )?.[1];

            // Simulate error auth message
            const mockEvent = {
                origin: window.location.origin,
                data: { type: 'NOTION_AUTH_ERROR', error: 'User cancelled' }
            } as MessageEvent;

            // Call the listener directly
            await act(async () => {
                messageListener(mockEvent);
            });

            // Should have closed the popup
            expect(mockPopup.close).toHaveBeenCalled();
        });

        it('should set error when creating integration returns non-ok (handleAuthSuccess else path)', async () => {
            // Mock POST to create integration -> ok: false
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                json: async () => ({})
            });

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const connectBtn = screen.getByTestId('connect-integration');

            await act(async () => {
                connectBtn.click();
            });

            const messageListener = (window.addEventListener as jest.SpyInstance).mock.calls.find(
                call => call[0] === 'message'
            )?.[1];

            const mockEvent = {
                origin: window.location.origin,
                data: { type: 'NOTION_AUTH_SUCCESS', accessToken: 'bad-token' }
            } as MessageEvent;

            await act(async () => {
                messageListener(mockEvent);
            });

            await waitFor(() => {
                expect(screen.getByTestId('error')).toHaveTextContent('Failed to create integration');
                expect(screen.getByTestId('is-connecting')).toHaveTextContent('false');
            });
        });

        it('should set error when creating integration throws (handleAuthSuccess catch path)', async () => {
            // Mock POST to create integration -> throws
            (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            const connectBtn = screen.getByTestId('connect-integration');

            await act(async () => {
                connectBtn.click();
            });

            const messageListener = (window.addEventListener as jest.SpyInstance).mock.calls.find(
                call => call[0] === 'message'
            )?.[1];

            const mockEvent = {
                origin: window.location.origin,
                data: { type: 'NOTION_AUTH_SUCCESS', accessToken: 'any-token' }
            } as MessageEvent;

            await act(async () => {
                messageListener(mockEvent);
            });

            await waitFor(() => {
                expect(screen.getByTestId('error')).toHaveTextContent('Failed to create integration');
                expect(screen.getByTestId('is-connecting')).toHaveTextContent('false');
            });
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

    describe('OAuth popup callback postMessage', () => {
        let originalOpener: any;
        let originalClose: any;

        beforeEach(() => {
            originalOpener = (window as any).opener;
            originalClose = (window as any).close;
            Object.defineProperty(window, 'close', { value: jest.fn(), writable: true });
        });

        afterEach(() => {
            Object.defineProperty(window, 'opener', { value: originalOpener, writable: true });
            Object.defineProperty(window, 'close', { value: originalClose, writable: true });
        });

        it('posts NOTION_AUTH_SUCCESS with token and closes when access_token param exists', async () => {
            const postMessage = jest.fn();
            Object.defineProperty(window, 'opener', { value: { postMessage }, writable: true });

            // Set URL to include access_token
            mockLocation.search = '?access_token=test-success-token';

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            await waitFor(() => {
                expect(postMessage).toHaveBeenCalledWith(
                    {
                        type: 'NOTION_AUTH_SUCCESS',
                        accessToken: 'test-success-token'
                    },
                    window.location.origin
                );
                expect(window.close).toHaveBeenCalled();
            });
        });

        it('posts NOTION_AUTH_ERROR mapped message and closes when error param exists', async () => {
            const postMessage = jest.fn();
            Object.defineProperty(window, 'opener', { value: { postMessage }, writable: true });

            // Set URL to include error
            mockLocation.search = '?error=access_denied';

            render(
                <IntegrationProvider>
                    <TestComponent />
                </IntegrationProvider>
            );

            await waitFor(() => {
                expect(postMessage).toHaveBeenCalledWith(
                    {
                        type: 'NOTION_AUTH_ERROR',
                        error: 'Authorization was cancelled'
                    },
                    window.location.origin
                );
                expect(window.close).toHaveBeenCalled();
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
