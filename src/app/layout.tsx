// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// NEW: Add our authentication context
import { AuthProvider } from "./components/auth/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono", 
  subsets: ["latin"],
});

// Updated metadata for your health app
export const metadata: Metadata = {
  title: "The Fittest You Health Tracker",
  description: "Track your health journey with Dr. Nick",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Booking widget perf hints */}
        <link rel="dns-prefetch" href="https://www.cnvrsnly.com" />
        <link rel="preconnect" href="https://www.cnvrsnly.com" crossOrigin="anonymous" />
        {/* Template fonts (Google Fonts) for Fabric canvas rendering */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Poppins:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap"
        />
        {/* Supabase Storage/CDN perf hints */}
        <link rel="dns-prefetch" href="https://pobkamvdnbxhmyfwbnsj.supabase.co" />
        <link rel="preconnect" href="https://pobkamvdnbxhmyfwbnsj.supabase.co" crossOrigin="anonymous" />
        {/* YouTube perf hints (poster/iframe assets) */}
        <link rel="dns-prefetch" href="https://www.youtube-nocookie.com" />
        <link rel="preconnect" href="https://www.youtube-nocookie.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://www.youtube.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://i9.ytimg.com" />
        <link rel="dns-prefetch" href="https://s.ytimg.com" />
        <link rel="dns-prefetch" href="https://www.google.com" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        {/* Booking widget script is embedded where used */}
      </body>
    </html>
  );
}