import { ResponsibilityPhase } from "@prisma/client";

/** §8.1 — Cycle de responsabilité (référentiel CDC, hors UI dashboard). */
export const CDC_RESPONSIBILITY_CYCLE_REF = "8.1";

export type CdcResponsibilityPhaseDef = {
  phase: ResponsibilityPhase;
  /** Libellé opérationnel affiché (ex. Chantier pour SITE). */
  title: string;
  /** Intitulé CDC du maillon. */
  cdcStage: string;
  /** Rôle détenteur attendu à ce maillon. */
  holderRole: string;
  order: number;
};

/** Ordre CDC : Stock → Transport → Chantier → Démontage → Retour stock. */
export const CDC_RESPONSIBILITY_PHASES: readonly CdcResponsibilityPhaseDef[] = [
  {
    phase: ResponsibilityPhase.STOCK,
    title: "Stock",
    cdcStage: "STOCK",
    holderRole: "Gestionnaire de stock",
    order: 1,
  },
  {
    phase: ResponsibilityPhase.TRANSPORT,
    title: "Transport",
    cdcStage: "TRANSPORT",
    holderRole: "Chauffeur",
    order: 2,
  },
  {
    phase: ResponsibilityPhase.SITE,
    title: "Chantier",
    cdcStage: "CHANTIER",
    holderRole: "Chef d'équipe",
    order: 3,
  },
  {
    phase: ResponsibilityPhase.DEMOUNT,
    title: "Démontage",
    cdcStage: "DÉMONTAGE",
    holderRole: "Responsable technique",
    order: 4,
  },
  {
    phase: ResponsibilityPhase.RETURN_STOCK,
    title: "Retour stock",
    cdcStage: "RETOUR STOCK",
    holderRole: "Gestionnaire de stock",
    order: 5,
  },
] as const;

export const CDC_RESPONSIBILITY_PRINCIPLE =
  "Chaque transfert entre deux maillons est validé par signature électronique. En cas de perte ou casse, le détenteur en cours au moment de l'incident est identifié sans ambiguïté.";

const PHASE_BY_ENUM = new Map(
  CDC_RESPONSIBILITY_PHASES.map((p) => [p.phase, p]),
);

export function getCdcPhaseDef(phase: ResponsibilityPhase): CdcResponsibilityPhaseDef {
  const def = PHASE_BY_ENUM.get(phase);
  if (!def) {
    return {
      phase,
      title: phase,
      cdcStage: phase,
      holderRole: "—",
      order: 99,
    };
  }
  return def;
}

export function cdcPhaseTitle(phase: ResponsibilityPhase): string {
  return getCdcPhaseDef(phase).title;
}

export function cdcHolderRoleLabel(phase: ResponsibilityPhase): string {
  return getCdcPhaseDef(phase).holderRole;
}
