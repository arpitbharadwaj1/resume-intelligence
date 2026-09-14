import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Navbar } from "@/components/ui/navbar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Resume Intelligence",
  description:
    "Understand what your resume is doing well, what is holding it back, and what to change — with the evidence behind every finding.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
