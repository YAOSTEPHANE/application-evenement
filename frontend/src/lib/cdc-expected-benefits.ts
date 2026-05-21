import type { AppIconName } from "@/components/icons/AppIcon";

export const CDC_EXPECTED_BENEFITS_TITLE = "Bénéfices attendus";

export type CdcExpectedBenefit = {
  id: string;
  icon: AppIconName;
  text: string;
};

/** Bénéfices CDC EVENT·RFID (cahier des charges). */
export const CDC_EXPECTED_BENEFITS: CdcExpectedBenefit[] = [
  {
    id: "traceability",
    icon: "shield",
    text: "Suppression des pertes et casses non imputées grâce à une responsabilité numérique tracée de bout en bout.",
  },
  {
    id: "automation",
    icon: "scan",
    text: "Réduction du temps de traitement des entrées et sorties par la lecture automatique des tags via portiques et douchettes.",
  },
  {
    id: "inventory",
    icon: "check",
    text: "Fiabilisation des inventaires (taux d'écart cible inférieur à 2 %).",
  },
  {
    id: "coordination",
    icon: "team",
    text: "Amélioration de la coordination entre commercial, stock, technique et parc camion par la circulation instantanée de l'information.",
  },
  {
    id: "dashboard",
    icon: "dashboard",
    text: "Disponibilité d'un tableau de bord temps réel pour la direction opérationnelle.",
  },
];

export function inventoryBenefitLabel(gapTargetPct = 2): string {
  return `Fiabilisation des inventaires (taux d'écart cible inférieur à ${gapTargetPct} %).`;
}
