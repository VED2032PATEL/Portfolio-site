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

const deploymentHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const siteUrl = new URL(
  process.env.SITE_URL ||
    (deploymentHost ? `https://${deploymentHost}` : 'http://localhost:3000'),
);

export const metadata: Metadata = {
  icons: { icon: '/favicon.svg' },
  metadataBase: siteUrl,
  title: 'Ved Patel | AI & Software Developer',
  description:
    'Ved Patel — Computer Science student building AI assistants, full-stack applications, and reproducible machine learning experiments. Explore StudyFlow, U2.7, and MemoryForge.',
  openGraph: {
    type: 'website',
    url: siteUrl,
    title: 'Ved Patel | AI & Software Developer',
    description:
      'Practical AI, thoughtful automation, and software built through curiosity.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Ved Patel — interactive developer portfolio',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ved Patel | AI & Software Developer',
    description: 'Explore StudyFlow, U2.7, and MemoryForge.',
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
