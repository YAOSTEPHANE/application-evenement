export type CdcStrategicObjective = {
  objective: string;
  description: string;
};

export const CDC_STRATEGIC_OBJECTIVES_SECTION = "2.2";

export const CDC_STRATEGIC_OBJECTIVES_TITLE = "Objectifs stratégiques";

/** Objectifs CDC EVENT·RFID § 2.2 */
export const CDC_STRATEGIC_OBJECTIVES: readonly CdcStrategicObjective[] = [
  {
    objective: "Traçabilité totale",
    description:
      "Suivre chaque article individuellement à toutes les étapes de son cycle de vie",
  },
  {
    objective: "Responsabilité claire",
    description:
      "Identifier à tout instant le détenteur responsable d'un article en cas de perte ou casse",
  },
  {
    objective: "Automatisation",
    description: "Réduire la saisie manuelle par la lecture automatique RFID",
  },
  {
    objective: "Coordination en temps réel",
    description:
      "Notifier instantanément tous les acteurs concernés à chaque événement métier",
  },
  {
    objective: "Pilotage par la donnée",
    description:
      "Disposer d'indicateurs fiables pour les décisions stratégiques et opérationnelles",
  },
];
