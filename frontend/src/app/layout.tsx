import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "</>bot — GitHub Repo Q&A",
  description: "Know your repository before you deploy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ height: "100vh", overflow: "hidden" }}>{children}</body>
    </html>
  );
}
