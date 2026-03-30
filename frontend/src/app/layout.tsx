import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockEvent Pro — Gestion de Stock Événementiel",
  description: "Application de gestion de stock événementiel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
