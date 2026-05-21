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
      "Par tag : localisation actuelle, historique des mouvements sur bons signés, état physique.",
    tab: "units",
  },
  {
    id: "quarantine",
    title: "Quarantaine numérique",
    summary: "Automatique pour matériel à réparer ou au rebut, et après écart RFID.",
    tab: "units",
  },
  {
    id: "inventory_sample",
    title: "Inventaire par sondage",
    summary: "Analyse des tags scannés (douchette) vs parc attendu.",
    tab: "inventory",
  },
  {
    id: "search",
    title: "Recherche multicritère",
    summary: "Tag, désignation, catégorie, emplacement, filtres état et type.",
    tab: "units",
  },
];
