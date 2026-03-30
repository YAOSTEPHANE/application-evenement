"use client";

import { Topbar } from "./Topbar";

export function TopbarClient() {
  return (
    <Topbar
      onOpenAlerts={() => {
        // TODO: brancher sur navigation interne
        console.log("Ouverture des alertes");
      }}
      onSearchChange={(value) => {
        // TODO: brancher sur recherche globale
        console.log("Recherche globale:", value);
      }}
    />
  );
}

