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
        {/* Calendly perf hints */}
        <link rel="dns-prefetch" href="https://assets.calendly.com" />
        <link rel="preconnect" href="https://assets.calendly.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        {/* Calendly script globally so it’s ready when the section mounts */}
        <script defer src="https://assets.calendly.com/assets/external/widget.js" />
      </body>
    </html>
  );
}