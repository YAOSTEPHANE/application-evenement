import type { Role } from "@prisma/client";

/** Profil principal CDC — un seul par utilisateur. */
export type CdcRoleProfile = {
  role: Role;
  /** Libellé profil (colonne PROFIL). */
  profileLabel: string;
  /** Rôle métier (colonne RÔLE MÉTIER). */
  businessRole: string;
  /** Droits principaux (colonne DROITS PRINCIPAUX). */
  mainRights: string;
};

/**
 * Les sept profils utilisateurs du CDC (§ matrice de validation).
 * MANAGER en base = supervision héritée (droits proches administrateur) — non proposé à la création.
 */
export const CDC_ROLE_PROFILES: readonly CdcRoleProfile[] = [
  {
    role: "ADMIN",
    profileLabel: "Administrateur",
    businessRole: "Direction / supervision globale",
    mainRights:
      "Tous droits, arbitrage des litiges, validation finale",
  },
  {
    role: "COMMERCIAL",
    profileLabel: "Commercial",
    businessRole: "Création des demandes clients",
    mainRights: "Création des commandes, consultation des stocks",
  },
  {
    role: "STOREKEEPER",
    profileLabel: "Gestionnaire de stock",
    businessRole: "Gestion physique des entrepôts",
    mainRights: "Validation des BE/BS/BT, gestion physique",
  },
  {
    role: "TECHNICAL_MANAGER",
    profileLabel: "Resp. technique",
    businessRole: "Composition des équipes",
    mainRights: "Affectation techniciens, désignation chef d'équipe",
  },
  {
    role: "FLEET_MANAGER",
    profileLabel: "Resp. parc camion",
    businessRole: "Gestion de la flotte",
    mainRights: "Affectation véhicules, planning logistique",
  },
  {
    role: "TECHNICIAN",
    profileLabel: "Technicien / monteur",
    businessRole: "Exécution terrain",
    mainRights: "Consultation mobile, signature des transferts",
  },
  {
    role: "VIEWER",
    profileLabel: "Utilisateur lambda",
    businessRole: "Consultation simple",
    mainRights: "Lecture seule sur l'état des stocks",
  },
] as const;

/** Profils proposés à la création / édition utilisateur (7 CDC). */
export const CDC_MAIN_PROFILE_ROLES: Role[] = CDC_ROLE_PROFILES.map((p) => p.role);

export function getCdcRoleProfile(role: Role): CdcRoleProfile | undefined {
  return CDC_ROLE_PROFILES.find((p) => p.role === role);
}

/** Libellé profil pour affichage (inclut MANAGER hérité). */
export function profileLabelForRole(role: Role): string {
  if (role === "MANAGER") {
    return "Supervision (hérité)";
  }
  return getCdcRoleProfile(role)?.profileLabel ?? role;
}

/** Libellé UI stock (sélecteurs legacy HomeClient). */
export type UiUserRole =
  | "Administrateur"
  | "Commercial"
  | "Gestionnaire de stock"
  | "Resp. technique"
  | "Resp. parc camion"
  | "Technicien / monteur"
  | "Utilisateur lambda"
  | "Supervision (hérité)";

const PRISMA_TO_UI: Record<Role, UiUserRole> = {
  ADMIN: "Administrateur",
  MANAGER: "Supervision (hérité)",
  COMMERCIAL: "Commercial",
  STOREKEEPER: "Gestionnaire de stock",
  TECHNICAL_MANAGER: "Resp. technique",
  FLEET_MANAGER: "Resp. parc camion",
  TECHNICIAN: "Technicien / monteur",
  VIEWER: "Utilisateur lambda",
};

const UI_TO_PRISMA: Record<UiUserRole, Role> = {
  Administrateur: "ADMIN",
  Commercial: "COMMERCIAL",
  "Gestionnaire de stock": "STOREKEEPER",
  "Resp. technique": "TECHNICAL_MANAGER",
  "Resp. parc camion": "FLEET_MANAGER",
  "Technicien / monteur": "TECHNICIAN",
  "Utilisateur lambda": "VIEWER",
  "Supervision (hérité)": "MANAGER",
};

export function uiRoleFromPrisma(role: Role): UiUserRole {
  return PRISMA_TO_UI[role] ?? "Utilisateur lambda";
}

export function prismaRoleFromUi(ui: string): Role {
  if (ui in UI_TO_PRISMA) {
    return UI_TO_PRISMA[ui as UiUserRole];
  }
  if (ui === "Gestionnaire") return "MANAGER";
  if (ui === "Magasinier") return "STOREKEEPER";
  if (ui === "Technicien") return "TECHNICIAN";
  if (ui === "Lecture seule") return "VIEWER";
  return "VIEWER";
}

export const UI_ROLE_PROFILE_OPTIONS: UiUserRole[] = CDC_ROLE_PROFILES.map(
  (p) => PRISMA_TO_UI[p.role],
);
