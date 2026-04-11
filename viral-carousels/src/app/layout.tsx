/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ViralCarousels | You already have the content.",
  description: "Transform your existing content into highly engaging, viral carousels in seconds. Built for creators who refuse to be inconsistent.",
  openGraph: {
    title: "ViralCarousels",
    description: "Transform your existing content into highly engaging, viral carousels in seconds.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;600;700;900&family=Space+Mono&display=swap" 
          rel="stylesheet" 
        />
        {/* Placeholder for future Supabase pre-connects and pre-fetches */}
      </head>
      <body className="marketing-theme">
        {/*
          <AuthProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </AuthProvider>
        */}
        {children}
      </body>
    </html>
  );
}
