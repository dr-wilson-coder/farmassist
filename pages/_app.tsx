// ═══════════════════════════════════════════════════════════════════════════════
// FILE: pages/_app.tsx
// This file makes globals.css apply to every page.
// If you don't already have this file, create it. If you do, just make sure
// the import line matches.
// ═══════════════════════════════════════════════════════════════════════════════

import type { AppProps } from 'next/app';

import '../styles/globals.css';
import '../styles/farmassist-premium.css';
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}