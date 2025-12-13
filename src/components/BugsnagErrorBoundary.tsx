'use client';

import React from 'react';
import Bugsnag from '@bugsnag/js';
import BugsnagPluginReact from '@bugsnag/plugin-react';

const apiKey = process.env.NEXT_PUBLIC_BUGSNAG_API_KEY;

if (process.env.NODE_ENV === 'production' && apiKey) {
  Bugsnag.start({
    apiKey,
    plugins: [new BugsnagPluginReact()],
  });
}

const Boundary =
  Bugsnag.getPlugin('react')?.createErrorBoundary(React) ??
  (({ children }: { children: React.ReactNode }) => <>{children}</>);

export function BugsnagErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Boundary>{children}</Boundary>;
}


