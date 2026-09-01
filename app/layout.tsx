import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const siteUrl = new URL('https://cursor-mascot-portfolio.yyyyue.chatgpt.site');

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: 'Interactive Portfolio',
  description:
    'An interactive portfolio experience with a cursor-responsive 3D character.',
  openGraph: {
    type: 'website',
    url: siteUrl,
    title: 'Interactive Portfolio',
    description: 'A cursor-responsive 3D experience',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Interactive Portfolio — a cursor-responsive 3D experience',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Interactive Portfolio',
    description: 'A cursor-responsive 3D experience',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
