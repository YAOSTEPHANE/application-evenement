export type CdcGlossaryEntry = { term: string; definition: string };

/** Lexique CDC EVENT·RFID (cahier des charges). */
export const CDC_GLOSSARY_ENTRIES: CdcGlossaryEntry[] = [
  {
    term: "RFID",
    definition:
      "Radio-Frequency Identification — technologie d'identification par ondes radio",
  },
  {
    term: "Tag",
    definition:
      "Étiquette électronique fixée à un article, contenant un identifiant unique",
  },
  {
    term: "Portique",
    definition:
      "Lecteur RFID fixe installé aux passages d'entrée/sortie d'un site",
  },
  {
    term: "Douchette",
    definition:
      "Lecteur RFID portatif utilisé pour les opérations d'inventaire ou de contrôle",
  },
  {
    term: "BE",
    definition:
      "Bon d'Entrée — document numérique attestant l'entrée d'un matériel en stock",
  },
  {
    term: "BS",
    definition:
      "Bon de Sortie — document numérique attestant la sortie de matériel d'un site",
  },
  {
    term: "BT",
    definition:
      "Bon de Transfert — document numérique attestant un mouvement inter-sites",
  },
  {
    term: "ERP",
    definition:
      "Enterprise Resource Planning — système d'information de gestion intégrée",
  },
];

export const CDC_GLOSSARY_TITLE = "Glossaire";
