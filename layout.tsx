import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skye Performance Hub",
  description:
    "Per-staff performance management for Skye College: role scorecards, Q2/Q4 reviews, feedback and due dates.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
