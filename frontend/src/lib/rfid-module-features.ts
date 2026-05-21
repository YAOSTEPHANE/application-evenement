/**
 * CDC §5.4 — Fonctionnalités attendues du module Identification RFID.
 * Référence produit (pas d’affichage CDC dans le dashboard).
 */

export type RfidModuleFeatureId =
  | "catalog"
  | "unit_tracking"
  | "quarantine"
  | "inventory_sample"
  | "search";

export type RfidModuleFeature = {
  id: RfidModuleFeatureId;
  title: string;
  summary: string;
  tab?: "catalog" | "units" | "inventory" | "douchettes";
};

export const RFID_MODULE_FEATURES: RfidModuleFeature[] = [
  {
    id: "catalog",
    title: "Catalogue matériel",
    summary:
      "Photo, désignation, catégorie, type de tag recommandé et caractéristiques techniques par référence.",
    tab: "catalog",
  },
  {
    id: "unit_tracking",
    title: "Suivi unitaire",
    summary:
      "Par tag : localisation actuelle, historique des mouvements sur bons signés, état physique (Bon, À réparer, Rebut…).",
    tab: "units",
  },
  {
    id: "quarantine",
    title: "Quarantaine numérique",
    summary:
      "Automatique dès qu’un article est « À réparer » ou « Mis au rebut », ou après écart scan portique / douchette.",
    tab: "units",
  },
  {
    id: "inventory_sample",
    title: "Inventaire par sondage",
    summary:
      "Saisie ou import des tags lus à la douchette : écarts, inconnus et couverture du périmètre entrepôt.",
    tab: "inventory",
  },
  {
    id: "search",
    title: "Recherche multicritère",
    summary: "Tag RFID, désignation, référence, catégorie, emplacement, état, type de tag, statut.",
    tab: "units",
  },
];

/** États physiques affichés (alignés CDC §5.4). */
export const RFID_PHYSICAL_STATE_HINT =
  "Bon · À réparer (quarantaine) · Mis au rebut — état modifiable sur chaque unité.";
