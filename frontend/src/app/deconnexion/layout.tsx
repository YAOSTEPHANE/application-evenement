import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Déconnexion — StockEvent Pro",
  description: "Déconnexion de StockEvent Pro",
};

export default function DeconnexionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
