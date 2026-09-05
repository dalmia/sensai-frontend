import { render, screen } from '@testing-library/react';
import RootLayout, { metadata } from '@/app/layout';

// Mock Google Fonts
jest.mock('next/font/google', () => ({
    Geist: () => ({
        variable: '--font-geist-sans',
    }),
    Geist_Mono: () => ({
        variable: '--font-geist-mono',
    }),
}));

// Mock SessionProvider
jest.mock('@/providers/SessionProvider', () => {
    return {
        SessionProvider: ({ children }: { children: React.ReactNode }) => (
            <div data-testid="session-provider">{children}</div>
        ),
    };
});


// Create a test wrapper that extracts the body content
function TestWrapper({ children }: { children: React.ReactNode }) {
    const layout = RootLayout({ children });
    // Extract the body content from the layout
    const bodyContent = layout.props.children.props.children;
    return bodyContent;
}

describe('Layout', () => {
    describe('Metadata', () => {
        it('should have correct title and description', () => {
            expect(metadata.title).toMatchObject({ default: 'SensAI', template: '%s · SensAI' });
            expect(metadata.description).toBe('The only LMS you need in the era of AI');
        });
    });

    describe('Layout Structure', () => {
        it('should render with proper structure', () => {
            render(
                <TestWrapper>
                    <div>Test Content</div>
                </TestWrapper>
            );

            expect(screen.getByTestId('session-provider')).toBeInTheDocument();
            expect(screen.getByText('Test Content')).toBeInTheDocument();
        });

        it('should wrap children in SessionProvider', () => {
            render(
                <TestWrapper>
                    <div data-testid="test-child">Test Content</div>
                </TestWrapper>
            );

            const sessionProvider = screen.getByTestId('session-provider');
            const testChild = screen.getByTestId('test-child');

            expect(sessionProvider).toBeInTheDocument();
            expect(sessionProvider).toContainElement(testChild);
        });
    });
}); 