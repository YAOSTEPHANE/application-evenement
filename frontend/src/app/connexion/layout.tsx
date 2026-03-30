import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion — StockEvent Pro",
  description: "Connectez-vous à StockEvent Pro",
};

export default function ConnexionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
