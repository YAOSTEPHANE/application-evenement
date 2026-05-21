import type { AppIconName } from "@/components/icons/AppIcon";

/**
 * Feuille de route CDC EVENT·RFID — modules à implémenter un par un.
 * Référence développement : `.cursor/rules/cdc-event-rfid.mdc`
 */

/** Pages accessibles depuis le menu principal EVENT·RFID (8 modules). */
export type CdcModulePageId =
  | "rfid"
  | "commandes"
  | "bons"
  | "traceabilite"
  | "rh"
  | "validation"
  | "alertes"
  | "dashboard";

export type CdcModuleId =
  | "rfid-identification"
  | "orders"
  | "material-movements"
  | "traceability-responsibility"
  | "hr"
  | "validation-matrix"
  | "alerts-notifications"
  | "dashboard-reporting";

export type CdcModuleStatus = "planned" | "in_progress" | "done";

export type CdcModuleDefinition = {
  id: CdcModuleId;
  /** Numéro CDC (ex. « Module 1 ») */
  number: number;
  title: string;
  /** Libellé court menu latéral */
  navLabel: string;
  page: CdcModulePageId;
  icon: AppIconName;
  summary: string;
  /** Fichiers / zones code principales (point d'entrée pour l'implémentation) */
  codePaths: readonly string[];
  status: CdcModuleStatus;
  badgeId?: "nb-alertes";
  badgeDanger?: boolean;
};

/** Ordre d'implémentation convenu : un module à la fois, du 1 au 8. */
export const CDC_MODULES: readonly CdcModuleDefinition[] = [
  {
    id: "rfid-identification",
    number: 1,
    title: "Identification RFID du matériel",
    navLabel: "Identification RFID",
    page: "rfid",
    icon: "rfid",
    summary:
      "Tags unitaires, association article/tag, lecteurs portique et douchette, statuts actif.",
    codePaths: [
      "src/lib/rfid-db.ts",
      "src/app/api/rfid-tags/route.ts",
      "src/app/api/rfid-portals/route.ts",
      "src/app/api/rfid-portals/by-code/[code]/scan/route.ts",
      "src/app/api/rfid-handhelds/route.ts",
      "src/app/api/rfid-handhelds/by-code/[code]/scan/route.ts",
      "src/app/api/portique/scan/route.ts",
      "src/app/api/handheld/scan/route.ts",
      "src/components/RfidHandheldsPanel.tsx",
      "src/app/api/hardware/devices/route.ts",
      "src/components/RfidPortiquesPanel.tsx",
      "src/components/CdcModulePages.tsx (page rfid)",
    ],
    status: "done",
  },
  {
    id: "orders",
    number: 2,
    title: "Gestion des commandes",
    navLabel: "Commandes",
    page: "commandes",
    icon: "orders",
    summary:
      "Commandes événementielles, statuts, allocations matériel, coordination commercial / stock.",
    codePaths: [
      "src/app/api/events/route.ts",
      "src/app/api/events/[id]/route.ts",
      "src/app/api/events/[id]/allocations/route.ts",
      "src/components/CdcModulePages.tsx (page commandes)",
    ],
    status: "done",
  },
  {
    id: "material-movements",
    number: 3,
    title: "Mouvements de matériel",
    navLabel: "Mouvements de matériel",
    page: "bons",
    icon: "documents",
    summary:
      "Bons numériques, scan lignes, signatures électroniques, PDF archivé, principe directeur.",
    codePaths: [
      "src/lib/stock-document-db.ts",
      "src/lib/stock-document-kpis.ts",
      "src/lib/cdc-directing-principle.ts",
      "src/app/api/stock-documents/**",
      "src/app/api/cdc/movements/kpis/route.ts",
      "src/app/api/movements/route.ts",
      "src/components/MovementsModulePage.tsx",
      "src/components/ModalStockDocument.tsx",
      "src/components/CdcDocumentWizard.tsx",
      "src/components/CdcDirectingPrinciple.tsx",
    ],
    status: "done",
  },
  {
    id: "traceability-responsibility",
    number: 4,
    title: "Traçabilité et chaîne de responsabilité",
    navLabel: "Traçabilité",
    page: "traceabilite",
    icon: "shield",
    summary:
      "Historique détenteur, imputation perte/casse, chaîne par événement (commercial → stock → technique → parc).",
    codePaths: [
      "src/lib/cdc-responsibility-cycle.ts",
      "src/lib/cdc-traceability-features.ts",
      "src/lib/responsibility-db.ts",
      "src/lib/responsibility-anomalies.ts",
      "src/lib/responsibility-chain.ts",
      "src/lib/traceability-db.ts",
      "src/lib/traceability-asset-history.ts",
      "src/lib/traceability-user-history.ts",
      "src/app/api/cdc/responsibility/**",
      "src/app/api/cdc/traceability/**",
      "src/components/ResponsibilityChain.tsx",
      "src/components/ResponsibilityChainGraph.tsx",
      "src/components/ResponsibilityCycleGuide.tsx",
      "src/components/TraceabilityModulePage.tsx",
    ],
    status: "done",
  },
  {
    id: "hr",
    number: 5,
    title: "Ressources humaines",
    navLabel: "Ressources humaines",
    page: "rh",
    icon: "team",
    summary:
      "Effectifs, affectations événement, véhicules, intérimaires, export paie / terrain.",
    codePaths: [
      "src/lib/cdc-hr-personnel.ts",
      "src/lib/hr-db.ts",
      "src/app/api/cdc/hr/categories/route.ts",
      "src/app/api/cdc/hr/stats/route.ts",
      "src/app/api/hr/staff/route.ts",
      "src/app/api/hr/assignments/route.ts",
      "src/app/api/hr/vehicles/route.ts",
      "src/app/api/hr/vehicles/[id]/route.ts",
      "src/app/api/hr/daily-workers/**",
      "src/components/HrModulePage.tsx",
      "src/components/HrPersonnelCategoriesGuide.tsx",
    ],
    status: "done",
  },
  {
    id: "validation-matrix",
    number: 6,
    title: "Validation",
    navLabel: "Validation",
    page: "validation",
    icon: "signature",
    summary:
      "Droits par rôle, chaînes de signature, file d'attente des bons, archives légales et 2FA.",
    codePaths: [
      "src/lib/cdc-role-profiles.ts",
      "src/lib/cdc-validation-principle.ts",
      "src/lib/cdc-validation-matrix.ts",
      "src/lib/validation-db.ts",
      "src/app/api/cdc/validation/matrix/route.ts",
      "src/app/api/cdc/validation/overview/route.ts",
      "src/lib/require-sensitive-auth.ts",
      "src/lib/totp-auth.ts",
      "src/components/ValidationModulePage.tsx",
      "src/components/ValidationPrincipleGuide.tsx",
    ],
    status: "done",
  },
  {
    id: "alerts-notifications",
    number: 7,
    title: "Alertes et notifications",
    navLabel: "Alertes",
    page: "alertes",
    icon: "alerts",
    badgeId: "nb-alertes",
    badgeDanger: true,
    summary:
      "Notifications temps réel aux acteurs, alertes planifiées (transferts, litiges, signatures en attente).",
    codePaths: [
      "src/lib/cdc-alerts.ts",
      "src/lib/cdc-notification-dispatch.ts",
      "src/lib/notification-db.ts",
      "src/app/api/notifications/route.ts",
      "src/app/api/cdc/alerts/run/route.ts",
      "src/components/AlertsModulePage.tsx",
      "src/app/api/cdc/alerts/run-now/route.ts",
    ],
    status: "done",
  },
  {
    id: "dashboard-reporting",
    number: 8,
    title: "Tableau de bord et reporting",
    navLabel: "Tableau de bord",
    page: "dashboard",
    icon: "dashboard",
    summary:
      "KPIs pilotage (commandes, bons, traçabilité, RH), objectifs CDC — sans texte documentaire CDC.",
    codePaths: [
      "src/components/DashboardModulePage.tsx",
      "src/lib/cdc-kpis-db.ts",
      "src/lib/dashboard-db.ts",
      "src/app/api/cdc/dashboard/overview/route.ts",
      "src/app/api/cdc/kpis/route.ts",
      "src/app/api/dashboard/route.ts",
      "src/components/AnalyticsRapports.tsx",
    ],
    status: "done",
  },
] as const;

export function getCdcModule(id: CdcModuleId): CdcModuleDefinition | undefined {
  return CDC_MODULES.find((m) => m.id === id);
}

export function cdcModuleLabel(module: CdcModuleDefinition): string {
  return `Module ${module.number} — ${module.title}`;
}

/** Ordre menu latéral — tableau de bord en premier, puis modules 1 → 7. */
const CDC_NAV_PAGE_ORDER: readonly CdcModulePageId[] = [
  "dashboard",
  "rfid",
  "commandes",
  "bons",
  "traceabilite",
  "rh",
  "validation",
  "alertes",
];

/** App mobile terrain (CDC §3.3) — package `mobile/`, hors back-office. */
export const CDC_MOBILE_FIELD_APP_PATHS = [
  "mobile/package.json",
  "mobile/app/index.tsx",
  "mobile/app/connexion.tsx",
  "mobile/src/screens/FieldAppScreen.tsx",
  "mobile/src/screens/LoginScreen.tsx",
  "mobile/src/lib/offline-queue.ts",
  "mobile/src/lib/offline-cache.ts",
  "mobile/app.json",
  "frontend/src/lib/cdc-mobile-offline.ts",
  "frontend/src/app/api/cdc/mobile/offline/route.ts",
  "frontend/src/app/api/handheld/scan/route.ts",
  "frontend/src/app/api/terrain/documents/route.ts",
  "frontend/src/app/api/terrain/my-assignments/route.ts",
  "frontend/src/app/api/terrain/incidents/route.ts",
] as const;

/** Entrées menu latéral EVENT·RFID. */
export const CDC_MODULE_NAV = CDC_NAV_PAGE_ORDER.map((page) => {
  const m = CDC_MODULES.find((mod) => mod.page === page);
  if (!m) {
    throw new Error(`Module CDC introuvable pour la page « ${page} »`);
  }
  return {
    page: m.page,
    icon: m.icon,
    label: m.navLabel,
    badgeId: m.badgeId,
    badgeDanger: m.badgeDanger,
  };
});

export function isCdcModulePage(page: string): page is CdcModulePageId {
  return CDC_MODULES.some((m) => m.page === page);
}
