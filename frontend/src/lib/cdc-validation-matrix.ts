import {
  BeSubtype,
  BsSubtype,
  BtSubtype,
  BtTransitPhase,
  StockDocumentKind,
  type Role,
} from "@prisma/client";

import { btAllSignSlots } from "@/lib/cdc-bt-document";
import { CDC_MAIN_PROFILE_ROLES } from "@/lib/cdc-role-profiles";

/**
 * Matrice formalisée §10 — appliquée à la signature via `assertCanSignDocument`
 * et `documentSignPlan` (ordre des rôles imposé). Principe : `cdc-validation-principle.ts`.
 */

export type SignSlot = { role: Role; label: string };

/** Sept profils CDC affichés dans la matrice des droits. */
export const MATRIX_ROLES: Role[] = [...CDC_MAIN_PROFILE_ROLES];

function isSupervisor(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/** Gestion des comptes utilisateurs */
export function canManageUsers(role: Role): boolean {
  return role === "ADMIN";
}

/** Lecture seule stocks (profil lambda) */
export function isReadOnlyStockProfile(role: Role): boolean {
  return role === "VIEWER";
}

/** Consultation de l'état des stocks (lambda = lecture seule uniquement). */
export function canConsultStock(role: Role): boolean {
  return true;
}

/** Modification physique / validation des bons en entrepôt */
export function canManagePhysicalStock(role: Role): boolean {
  return isSupervisor(role) || role === "STOREKEEPER";
}

/** Création / gestion commandes événement */
export function canManageCommercialOrders(role: Role): boolean {
  return isSupervisor(role) || role === "COMMERCIAL";
}

/** RH — affectation équipes, chefs d'équipe */
export function canManageHrTeams(role: Role): boolean {
  return isSupervisor(role) || role === "TECHNICAL_MANAGER";
}

/** Parc — véhicules et planning logistique */
export function canManageFleet(role: Role): boolean {
  return isSupervisor(role) || role === "FLEET_MANAGER";
}

/** App mobile terrain (scan / signature, package `mobile/`) */
export function canUseFieldApp(role: Role): boolean {
  return (
    isSupervisor(role) ||
    role === "STOREKEEPER" ||
    role === "TECHNICAL_MANAGER" ||
    role === "FLEET_MANAGER" ||
    role === "TECHNICIAN"
  );
}

/** Arbitrage litiges sur bons */
export function canArbitrateDisputes(role: Role): boolean {
  return isSupervisor(role);
}

export type ValidationDocScenario = {
  id: string;
  label: string;
  kind: StockDocumentKind;
  beSubtype?: BeSubtype;
  bsSubtype?: BsSubtype;
  btSubtype?: BtSubtype;
};

export const VALIDATION_DOC_SCENARIOS: ValidationDocScenario[] = [
  { id: "be", label: "Bon BE (entrée)", kind: StockDocumentKind.BE },
  { id: "be-ret", label: "Bon BE-RET", kind: StockDocumentKind.BE, beSubtype: BeSubtype.BE_RET },
  { id: "bs", label: "Bon BS (sortie)", kind: StockDocumentKind.BS },
  { id: "bs-evt", label: "Bon BS événement", kind: StockDocumentKind.BS, bsSubtype: BsSubtype.BS_EVT },
  { id: "bt", label: "Bon BT (transfert)", kind: StockDocumentKind.BT },
  { id: "bt-ee", label: "BT-EE entrepôt → entrepôt", kind: StockDocumentKind.BT, btSubtype: BtSubtype.BT_EE },
  { id: "bt-es", label: "BT-ES entrepôt → site", kind: StockDocumentKind.BT, btSubtype: BtSubtype.BT_ES },
  { id: "bt-ss", label: "BT-SS site → site", kind: StockDocumentKind.BT, btSubtype: BtSubtype.BT_SS },
  { id: "bt-se", label: "BT-SE site → entrepôt", kind: StockDocumentKind.BT, btSubtype: BtSubtype.BT_SE },
];

export type SensitiveActionDef = {
  id: string;
  label: string;
  description: string;
};

/** Actions protégées par 2FA (si rôle concerné ou 2FA activée). */
export const SENSITIVE_ACTIONS: SensitiveActionDef[] = [
  {
    id: "sign",
    label: "Signature électronique",
    description: "Valider un bon après scan RFID conforme.",
  },
  {
    id: "create_bs",
    label: "Création bon de sortie",
    description: "BS standard ou BS événement (chargement).",
  },
  {
    id: "create_bt",
    label: "Création bon de transfert",
    description: "Transfert inter-sites (émission / réception).",
  },
  {
    id: "cancel",
    label: "Annulation / contre-passation",
    description: "Annuler un bon ou générer le bon contraire.",
  },
];

/** Matrice CDC §10 — création de bons */
export function canCreateStockDocument(
  role: Role,
  kind: StockDocumentKind,
): boolean {
  if (role === "ADMIN" || role === "MANAGER") return true;
  if (role === "STOREKEEPER") return true;
  if (kind === StockDocumentKind.BS && role === "COMMERCIAL") return false;
  return false;
}

/** Création commande / événement commercial */
export function canCreateCommercialOrder(role: Role): boolean {
  return canManageCommercialOrders(role);
}

/** Annulation bon (bon contraire) */
export function canCancelStockDocument(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "STOREKEEPER";
}

/** Plan complet affiché (UI, matrice) — inclut les 2 signatures BT. */
export function documentSignPlan(
  kind: StockDocumentKind,
  opts: {
    bsSubtype?: BsSubtype | null;
    beSubtype?: BeSubtype | null;
    btSubtype?: BtSubtype | null;
    btTransitPhase?: BtTransitPhase | null;
  },
): SignSlot[] {
  if (kind === StockDocumentKind.BT) {
    return btAllSignSlots(opts.btSubtype);
  }
  return signSlotsForDocument(kind, opts);
}

export function signSlotsForDocument(
  kind: StockDocumentKind,
  opts: {
    bsSubtype?: BsSubtype | null;
    beSubtype?: BeSubtype | null;
    btSubtype?: BtSubtype | null;
    btTransitPhase?: BtTransitPhase | null;
  },
): SignSlot[] {
  const { bsSubtype, beSubtype, btSubtype, btTransitPhase } = opts;

  if (kind === StockDocumentKind.BE && beSubtype === BeSubtype.BE_RET) {
    return [
      { role: "STOREKEEPER", label: "Gestionnaire stock — réception retour" },
      { role: "TECHNICAL_MANAGER", label: "Chef d'équipe / Resp. technique" },
    ];
  }
  if (kind === StockDocumentKind.BE && beSubtype === BeSubtype.BE_FRN) {
    return [
      { role: "FLEET_MANAGER", label: "Livreur / transport" },
      { role: "STOREKEEPER", label: "Gestionnaire stock — réceptionnaire" },
    ];
  }
  if (kind === StockDocumentKind.BE && beSubtype === BeSubtype.BE_TRF) {
    return [
      { role: "FLEET_MANAGER", label: "Livreur / expéditeur site source" },
      { role: "STOREKEEPER", label: "Gestionnaire stock destinataire" },
    ];
  }
  if (kind === StockDocumentKind.BE && beSubtype === BeSubtype.BE_REP) {
    return [
      { role: "TECHNICAL_MANAGER", label: "Responsable technique — réintégration" },
      { role: "STOREKEEPER", label: "Gestionnaire stock — entrée stock" },
    ];
  }
  if (kind === StockDocumentKind.BE) {
    return [{ role: "STOREKEEPER", label: "Magasinier — entrée stock" }];
  }
  if (kind === StockDocumentKind.BS && bsSubtype === BsSubtype.BS_EVT) {
    return [
      { role: "STOREKEEPER", label: "Gestionnaire de stock — validation sortie physique" },
      { role: "FLEET_MANAGER", label: "Chauffeur — responsabilité pendant le transport" },
      {
        role: "TECHNICAL_MANAGER",
        label: "Chef d'équipe destinataire — réception sur site",
      },
    ];
  }
  if (kind === StockDocumentKind.BS && bsSubtype === BsSubtype.BS_LOC) {
    return [{ role: "ADMIN", label: "Administrateur — validation sous-location" }];
  }
  if (kind === StockDocumentKind.BS && bsSubtype === BsSubtype.BS_REP) {
    return [
      { role: "TECHNICAL_MANAGER", label: "Responsable technique — sortie réparation" },
    ];
  }
  if (kind === StockDocumentKind.BS && bsSubtype === BsSubtype.BS_RBT) {
    return [{ role: "ADMIN", label: "Administrateur — mise au rebut" }];
  }
  if (kind === StockDocumentKind.BS) {
    return [{ role: "STOREKEEPER", label: "Gestionnaire de stock — sortie" }];
  }
  if (kind === StockDocumentKind.BT) {
    const plan = btAllSignSlots(btSubtype);
    if (btTransitPhase === BtTransitPhase.IN_TRANSIT || btTransitPhase === BtTransitPhase.ARRIVAL) {
      return [plan[1] ?? plan[0]];
    }
    return [plan[0]];
  }
  return [{ role: "ADMIN", label: "Administrateur" }];
}

export function roleMatchesSignSlot(actorRole: Role, slot: SignSlot): boolean {
  if (isSupervisor(actorRole)) return true;
  if (actorRole === slot.role) return true;
  if (slot.role === "FLEET_MANAGER" && (actorRole === "TECHNICIAN" || actorRole === "FLEET_MANAGER")) {
    return true;
  }
  if (
    actorRole === "TECHNICIAN" &&
    (slot.role === "STOREKEEPER" || slot.role === "FLEET_MANAGER")
  ) {
    return true;
  }
  if (slot.role === "TECHNICAL_MANAGER" && actorRole === "TECHNICIAN") {
    return false;
  }
  return false;
}

export function assertCanSignDocument(
  actorRole: Role,
  kind: StockDocumentKind,
  signatureCount: number,
  opts: {
    bsSubtype?: BsSubtype | null;
    beSubtype?: BeSubtype | null;
    btSubtype?: BtSubtype | null;
    btTransitPhase?: BtTransitPhase | null;
  },
): void {
  const slots = documentSignPlan(kind, opts);
  if (signatureCount >= slots.length) {
    throw new Error("Ce bon est déjà entièrement signé.");
  }
  const next = slots[signatureCount];
  if (!roleMatchesSignSlot(actorRole, next)) {
    throw new Error(`Prochaine signature attendue : ${next.label}.`);
  }
}

export function totalSignaturesRequired(
  kind: StockDocumentKind,
  opts: {
    bsSubtype?: BsSubtype | null;
    beSubtype?: BeSubtype | null;
    btSubtype?: BtSubtype | null;
  },
): number {
  return documentSignPlan(kind, opts).length;
}
