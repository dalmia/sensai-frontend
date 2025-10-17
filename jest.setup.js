// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    pathname: '/',
    query: {},
  }),
  useSearchParams: () => ({
    get: jest.fn(),
    getAll: jest.fn(),
  }),
  usePathname: () => '/',
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...props} />;
  },
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: {
      user: { name: 'Test User', email: 'test@example.com' },
      expires: '2100-01-01T00:00:00.000Z',
    },
    status: 'authenticated',
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Set up environment variables for tests
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Add any custom Jest matchers here
expect.extend({}); 

// Polyfills for streaming tests
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder } = require('util');
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  const { TextDecoder } = require('util');
  global.TextDecoder = TextDecoder;
}