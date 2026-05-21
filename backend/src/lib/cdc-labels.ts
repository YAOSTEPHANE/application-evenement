import type {
  BeSubtype,
  BsSubtype,
  BtSubtype,
  ItemCondition,
  OrderStatus,
  PortalPassageDirection,
  RfidTagType,
  Role,
  StaffCategory,
  StaffSpecialty,
  VehicleStatus,
  StockDocumentKind,
  StockDocumentStatus,
  TrackedAssetStatus,
} from "@prisma/client";

import { CDC_ORDER_LIFECYCLE, getOrderLifecycleStep } from "@/lib/cdc-order-lifecycle";
import { rfidTagTypologyLabels } from "@/lib/rfid-tag-typology";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  MANAGER: "Supervision (hérité)",
  COMMERCIAL: "Commercial",
  STOREKEEPER: "Gestionnaire de stock",
  TECHNICAL_MANAGER: "Resp. technique",
  FLEET_MANAGER: "Resp. parc camion",
  TECHNICIAN: "Technicien / monteur",
  VIEWER: "Utilisateur lambda",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: CDC_ORDER_LIFECYCLE[0].label,
  IN_PROGRESS: CDC_ORDER_LIFECYCLE[1].label,
  SETTLED: CDC_ORDER_LIFECYCLE[2].label,
};

export const ORDER_STATUS_SHORT_LABELS: Record<OrderStatus, string> = {
  PENDING: CDC_ORDER_LIFECYCLE[0].shortLabel,
  IN_PROGRESS: CDC_ORDER_LIFECYCLE[1].shortLabel,
  SETTLED: CDC_ORDER_LIFECYCLE[2].shortLabel,
};

export function orderStatusSignification(status: OrderStatus): string {
  return getOrderLifecycleStep(status).signification;
}

export const DOC_KIND_LABELS: Record<StockDocumentKind, string> = {
  BE: "Bon d'entrée",
  BS: "Bon de sortie",
  BT: "Bon de transfert",
};

export const DOC_STATUS_LABELS: Record<StockDocumentStatus, string> = {
  DRAFT: "Brouillon",
  SCANNING: "Scan en cours",
  PENDING_SIGNATURE: "En attente de signature",
  SIGNED: "Signé",
  CANCELLED: "Annulé",
  DISPUTED: "Litige",
};

export const BE_SUBTYPE_LABELS: Record<BeSubtype, string> = {
  BE_FRN: "BE-FRN — Réception fournisseur",
  BE_RET: "BE-RET — Retour prestation",
  BE_TRF: "BE-TRF — Réception transfert",
  BE_REP: "BE-REP — Réintégration réparation",
};

export const BS_SUBTYPE_LABELS: Record<BsSubtype, string> = {
  BS_EVT: "BS-EVT — Sortie événement",
  BS_LOC: "BS-LOC — Sous-location",
  BS_REP: "BS-REP — Réparation externe",
  BS_RBT: "BS-RBT — Rebut",
};

export const BT_SUBTYPE_LABELS: Record<BtSubtype, string> = {
  BT_EE: "BT-EE — Entrepôt → entrepôt",
  BT_ES: "BT-ES — Entrepôt → site",
  BT_SS: "BT-SS — Site → site",
  BT_SE: "BT-SE — Site → entrepôt",
};

export const PORTAL_PASSAGE_LABELS: Record<PortalPassageDirection, string> = {
  EXIT: "Sortie — contrôle BS",
  ENTRY: "Entrée — contrôle BE",
  BOTH: "Entrée et sortie",
};

/** Libellés courts — source : CDC §5.2 (`rfid-tag-typology.ts`). */
export const RFID_TAG_LABELS: Record<RfidTagType, string> = rfidTagTypologyLabels();

export const ASSET_STATUS_LABELS: Record<TrackedAssetStatus, string> = {
  AVAILABLE: "Disponible",
  IN_TRANSIT: "En transit",
  ON_SITE: "Sur site",
  QUARANTINE: "Quarantaine",
  SCRAPPED: "Rebut",
};

/** État physique CDC (Bon / Endommagé / À réparer / Rebut) */
export const ITEM_CONDITION_LABELS: Record<ItemCondition, string> = {
  NEW: "Neuf",
  GOOD: "Bon",
  NEEDS_REPAIR: "À réparer",
  OBSOLETE: "Mis au rebut",
};

export const STAFF_CATEGORY_LABELS: Record<StaffCategory, string> = {
  TEAM_LEADER: "Chef d'équipe",
  RIGGER_JUNIOR: "Monteur junior",
  RIGGER_CONFIRMED: "Monteur confirmé",
  RIGGER_SENIOR: "Monteur senior",
  DRIVER: "Chauffeur",
  DAY_LABORER: "Journalier",
};

export const STAFF_SPECIALTY_LABELS: Record<StaffSpecialty, string> = {
  COLD: "Froid",
  ELECTRICAL: "Électricité",
  DECORATION: "Décoration",
  STAND: "Stand / structure",
  CARPENTRY: "Menuiserie",
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  AVAILABLE: "Disponible",
  IN_USE: "En mission",
  MAINTENANCE: "Maintenance",
};

export function roleRequires2Fa(role: Role): boolean {
  return (
    role === "ADMIN" ||
    role === "STOREKEEPER" ||
    role === "TECHNICAL_MANAGER" ||
    role === "FLEET_MANAGER"
  );
}
