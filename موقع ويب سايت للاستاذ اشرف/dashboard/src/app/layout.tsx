import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "لوحة الإدارة | فُصحى — الأستاذ أشرف سليم",
  description: "إدارة محتوى وطلاب واختبارات منصة فُصحى للأستاذ أشرف سليم",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* Anti-flash theme init: runs before hydration/paint. Static export = no server-rendered theme, so this must run client-side, synchronously, before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" />
      </head>
      <body className="font-body-md bg-background text-on-background min-h-screen selection:bg-primary/20 selection:text-primary">
        {children}
      </body>
    </html>
  );
}
