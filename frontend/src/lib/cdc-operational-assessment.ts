export const CDC_CONTEXT_TITLE = "Contexte et objectifs";

export const CDC_OPERATIONAL_ASSESSMENT_SECTION = "2.1";

export const CDC_OPERATIONAL_ASSESSMENT_TITLE = "Constat opérationnel";

/** Parc matériel et rotation — CDC EVENT·RFID § 2.1 */
export const CDC_OPERATIONAL_ASSESSMENT_CONTEXT =
  "L'activité événementielle implique une rotation rapide et intensive d'un parc matériel composé de structures (chapiteaux, poteaux, planchers), de mobilier (chaises, tables, mange-debout), de revêtements (tapis, velums), de matériel technique (son, lumière, froid) et d'accessoires divers.";

export const CDC_OPERATIONAL_ASSESSMENT_LEAD =
  "L'analyse de l'organisation actuelle met en évidence plusieurs points de friction :";

/** Points de friction — CDC EVENT·RFID § 2.1 */
export const CDC_OPERATIONAL_ASSESSMENT_FRICTIONS: readonly string[] = [
  "Absence de traçabilité unitaire du matériel rendant impossible l'imputation des pertes.",
  "Inventaires annuels uniquement, avec écarts non maîtrisés entre stock théorique et physique.",
  "Absence de bons numériques formalisés (bon d'entrée, bon de sortie, transfert inter-sites).",
  "Coordination défaillante entre commerciaux, gestionnaires de stock, responsable technique et responsable parc camion.",
  "Outil ERP existant non adapté : non-responsive mobile, absence de tableau de bord, transmission de commandes peu fiable.",
  "Surcharge des entrepôts par du matériel vétuste, mélange entre matériel propre et sale, adressage non respecté.",
];
