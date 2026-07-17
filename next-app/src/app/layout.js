import { Suspense } from 'react';
import Providers from '@/components/Providers';
import './globals.css';

export const metadata = {
  title: {
    default: 'Monteeq',
    template: '%s | Monteeq',
  },
  description: 'Create and share video on Monteeq.',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export const viewport = {
  themeColor: '#000000',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Same non-blocking load as Vite index.html — avoids next/font build-time fetch failures */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Inter:wght@400;500;700&display=swap"
        />
      </head>
      <body>
        <Providers>
          <Suspense fallback={null}>{children}</Suspense>
        </Providers>
      </body>
    </html>
  );
}
