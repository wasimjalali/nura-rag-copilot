import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nura RAG Copilot",
  description:
    "A learning-first RAG support copilot for synthetic supplement e-commerce documents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
