import type { Metadata } from 'next';
<<<<<<< HEAD
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
=======
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jb' });

export const metadata: Metadata = { title: 'MobiFlow' };

<<<<<<< HEAD
// Runs before first paint so the saved theme applies without a flash (dark unless the user chose light).
=======
// Runs before first paint, so the saved theme applies without a flash.
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281
const themeScript = `try{if(localStorage.getItem('theme')!=='light')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
<<<<<<< HEAD
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
=======
    <html lang="en" className={mono.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}