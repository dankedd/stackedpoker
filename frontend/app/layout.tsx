import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stacked Poker — GTO-Inspired Hand Analysis",
  description:
    "Upload your GGPoker or PokerStars screenshot and get instant GTO coaching with solver-inspired analysis. Premium poker training platform.",
  keywords: ["poker", "GTO", "hand analysis", "poker coaching", "poker training", "PokerStars", "GGPoker", "Stacked Poker"],
  openGraph: {
    title: "Stacked Poker",
    description: "Premium AI-powered poker hand analysis and GTO coaching",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
