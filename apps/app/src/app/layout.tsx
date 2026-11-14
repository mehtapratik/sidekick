import './globals.css';

import { ColorSchemeScript } from '@mantine/core';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { appDescriptionCopy, appNameCopy } from '@sidekick/copy/app';

import { Providers } from './providers';

const geistSans = Geist({
   variable: '--font-geist-sans',
   subsets: ['latin'],
});

const geistMono = Geist_Mono({
   variable: '--font-geist-mono',
   subsets: ['latin'],
});

/** The default page title and description */
export const metadata: Metadata = {
   title: appNameCopy,
   description: appDescriptionCopy,
};

/** The root HTML document: fonts, colour scheme and the app's providers */
export default function RootLayout({
   children,
}: Readonly<{
   children: React.ReactNode;
}>): React.ReactElement {
   return (
      <html
         lang="en"
         className={`${geistSans.variable} ${geistMono.variable}`}
         suppressHydrationWarning
      >
         <head>
            <ColorSchemeScript defaultColorScheme="auto" />
         </head>
         <body>
            <Providers>{children}</Providers>
         </body>
      </html>
   );
}
