import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Intelligence",
  description:
    "Understand what your resume is doing well, what is holding it back, and what to change — with the evidence behind every finding.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
