"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

interface IntegrationPage {
    id: string;
    object: "page";
    properties?: {
        title?: { title: { plain_text: string }[] };
    };
}

interface IntegrationState {
    // Integration status
    hasIntegration: boolean;
    accessToken: string | null;
    isLoading: boolean;
    isIntegrationCheckComplete: boolean;
    error: string | null;

    // Pages data
    pages: IntegrationPage[];
    isLoadingPages: boolean;
    noPagesFound: boolean;

    // UI state
    showDropdown: boolean;
    isConnecting: boolean;
    isOAuthCallbackComplete: boolean;

    // Actions
    checkIntegration: () => Promise<void>;
    fetchPages: () => Promise<void>;
    connectIntegration: () => Promise<void>;
    disconnectIntegration: () => Promise<void>;
    setShowDropdown: (show: boolean) => void;
    setError: (error: string | null) => void;
}

const IntegrationContext = createContext<IntegrationState | undefined>(undefined);

interface IntegrationProviderProps {
    children: ReactNode;
}

export const IntegrationProvider: React.FC<IntegrationProviderProps> = ({ children }) => {
    const { user } = useAuth();

    // Integration status
    const [hasIntegration, setHasIntegration] = useState(false);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isIntegrationCheckComplete, setIsIntegrationCheckComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Pages data
    const [pages, setPages] = useState<IntegrationPage[]>([]);
    const [isLoadingPages, setIsLoadingPages] = useState(false);
    const [noPagesFound, setNoPagesFound] = useState(false);

    // UI state
    const [showDropdown, setShowDropdown] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isOAuthCallbackComplete, setIsOAuthCallbackComplete] = useState(false);

    const checkIntegration = useCallback(async () => {
        if (!user?.id) return;

        try {
            setIsLoading(true);
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/?user_id=${user.id}`);
            if (response.ok) {
                const integrations = await response.json();
                const integration = integrations.find((integration: { integration_type: string; access_token: string; id: number }) => integration.integration_type === 'notion');
                if (integration) {
                    setHasIntegration(true);
                    setAccessToken(integration.access_token);
                    setNoPagesFound(false);
                    setError(null);
                } else {
                    setHasIntegration(false);
                    setAccessToken(null);
                }
            }
        } catch {
            setError('Failed to check integration status');
        } finally {
            setIsLoading(false);
            setIsIntegrationCheckComplete(true);
        }
    }, [user?.id]);

    const fetchPages = useCallback(async () => {
        if (!accessToken) return;

        try {
            setIsLoadingPages(true);
            setError(null);
            setNoPagesFound(false);

            const response = await fetch(`/api/integrations/fetchPages?token=${encodeURIComponent(accessToken)}`);
            const data = await response.json();

            if (response.ok) {
                setPages(data.pages || []);
                setShowDropdown(true);
                if (data.pages && data.pages.length === 0) {
                    setNoPagesFound(true);
                }
            } else {
                setError(data.error || 'Failed to fetch pages');
                setNoPagesFound(true);
            }
        } catch (err) {
            setError('Failed to fetch pages');
            setNoPagesFound(true);
            console.error('Error fetching pages:', err);
        } finally {
            setIsLoadingPages(false);
        }
    }, [accessToken]);

    const connectIntegration = useCallback(async () => {
        if (!user?.id) return;

        setIsConnecting(true);
        const NOTION_CLIENT_ID = process.env.NEXT_PUBLIC_NOTION_CLIENT_ID || "";
        const currentUrl = window.location.href;
        const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${NOTION_CLIENT_ID}&response_type=code&state=${encodeURIComponent(currentUrl)}`;

        window.location.href = notionAuthUrl;
    }, [user?.id]);

    const disconnectIntegration = useCallback(async () => {
        if (!user?.id || !accessToken) return;

        try {
            setIsLoading(true);
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    integration_type: 'notion',
                }),
            });

            if (response.ok) {
                setHasIntegration(false);
                setAccessToken(null);
                setPages([]);
                setShowDropdown(false);
                setError(null);
                setNoPagesFound(false);
            } else {
                setError('Failed to disconnect Integration');
            }
        } catch {
            setError('Failed to disconnect Integration');
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, accessToken]);

    // Check for OAuth callback and initialize integration
    useEffect(() => {
        if (!user?.id) return;

        // Check for OAuth callback parameters
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('access_token');

        if (accessToken) {
            // Create the integration
            const createIntegration = async () => {
                setIsConnecting(true);
                try {
                    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_id: user.id,
                            integration_type: 'notion',
                            access_token: accessToken,
                        }),
                    });

                    if (response.ok) {
                        // Refresh integration status
                        await checkIntegration();
                        // Mark OAuth callback as complete
                        setIsOAuthCallbackComplete(true);
                    } else {
                        setError('Failed to create integration');
                    }
                } catch {
                    setError('Failed to create integration');
                } finally {
                    setIsConnecting(false);
                    // Clear URL parameters
                    const url = new URL(window.location.href);
                    url.searchParams.delete('access_token');
                    window.history.replaceState({}, document.title, url.pathname + url.search);
                }
            };

            createIntegration();
        } else {
            // Check existing integration
            checkIntegration();
        }
    }, [user?.id, checkIntegration]);

    // Fetch pages when we have an access token
    useEffect(() => {
        if (accessToken && hasIntegration) {
            fetchPages();
        }
    }, [accessToken, hasIntegration, fetchPages]);

    const contextValue: IntegrationState = {
        // Integration status
        hasIntegration,
        accessToken,
        isLoading,
        isIntegrationCheckComplete,
        error,

        // Pages data
        pages,
        isLoadingPages,
        noPagesFound,

        // UI state
        showDropdown,
        isConnecting,
        isOAuthCallbackComplete,

        // Actions
        checkIntegration,
        fetchPages,
        connectIntegration,
        disconnectIntegration,
        setShowDropdown,
        setError,
    };

    return (
        <IntegrationContext.Provider value={contextValue}>
            {children}
        </IntegrationContext.Provider>
    );
};

export const useIntegration = (): IntegrationState => {
    const context = useContext(IntegrationContext);
    if (context === undefined) {
        throw new Error('useIntegration must be used within a IntegrationProvider');
    }
    return context;
};
