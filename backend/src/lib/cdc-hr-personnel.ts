import { Role, StaffCategory, StaffSpecialty } from "@prisma/client";

/** §9.1 — Catégories de personnel (référentiel CDC, hors dashboard). */
export const CDC_HR_PERSONNEL_REF = "9.1";

export type CdcPersonnelGroup = {
  id: string;
  title: string;
  description: string;
  staffCategories?: StaffCategory[];
  specialties?: StaffSpecialty[];
  rules: string[];
};

export const CDC_PERSONNEL_GROUPS: readonly CdcPersonnelGroup[] = [
  {
    id: "TEAM_LEADER",
    title: "Chefs d'équipe",
    description: "Un chef d'équipe par projet (commande), désigné parmi les monteurs seniors.",
    staffCategories: [StaffCategory.TEAM_LEADER, StaffCategory.RIGGER_SENIOR],
    rules: [
      "Un seul chef d'équipe actif par commande",
      "Désignation parmi monteurs seniors ou profil chef d'équipe",
    ],
  },
  {
    id: "RIGGER",
    title: "Monteurs",
    description: "Junior, confirmé ou senior — spécialités métier.",
    staffCategories: [
      StaffCategory.RIGGER_JUNIOR,
      StaffCategory.RIGGER_CONFIRMED,
      StaffCategory.RIGGER_SENIOR,
    ],
    specialties: [
      StaffSpecialty.COLD,
      StaffSpecialty.ELECTRICAL,
      StaffSpecialty.DECORATION,
      StaffSpecialty.STAND,
      StaffSpecialty.CARPENTRY,
    ],
    rules: ["Spécialités : froid, électricité, décoration, stand, menuiserie"],
  },
  {
    id: "DRIVER",
    title: "Chauffeurs",
    description: "Rattachés à un véhicule du parc camion.",
    staffCategories: [StaffCategory.DRIVER],
    rules: ["Un chauffeur = un véhicule assigné sur le parc"],
  },
  {
    id: "DAY_LABORER",
    title: "Journaliers",
    description: "Effectif variable — présence quotidienne déclarée le matin.",
    rules: ["Saisie journalière (onglet Journaliers)", "Présence matin enregistrée à la déclaration"],
  },
] as const;

const RIGGER_CATEGORIES: StaffCategory[] = [
  StaffCategory.RIGGER_JUNIOR,
  StaffCategory.RIGGER_CONFIRMED,
  StaffCategory.RIGGER_SENIOR,
];

export function isRiggerCategory(category: StaffCategory): boolean {
  return RIGGER_CATEGORIES.includes(category);
}

export function canBeDesignatedTeamLeader(category: StaffCategory | undefined | null): boolean {
  if (!category) return false;
  return category === StaffCategory.TEAM_LEADER || category === StaffCategory.RIGGER_SENIOR;
}

export function categoryAllowsSpecialties(category: StaffCategory): boolean {
  return isRiggerCategory(category);
}

export function categoryRequiresVehicle(category: StaffCategory): boolean {
  return category === StaffCategory.DRIVER;
}

/** Rôles applicatifs proposés à la création d'un membre du personnel terrain. */
export const STAFF_MEMBER_APP_ROLES: Role[] = [
  Role.TECHNICIAN,
  Role.FLEET_MANAGER,
  Role.TECHNICAL_MANAGER,
  Role.STOREKEEPER,
];

export function defaultAppRoleForStaffCategory(category: StaffCategory): Role {
  if (category === StaffCategory.DRIVER) return Role.FLEET_MANAGER;
  return Role.TECHNICIAN;
}

/** Profils permanents (hors journaliers saisis à la journée). */
export const STAFF_PROFILE_CATEGORIES: StaffCategory[] = [
  StaffCategory.TEAM_LEADER,
  StaffCategory.RIGGER_JUNIOR,
  StaffCategory.RIGGER_CONFIRMED,
  StaffCategory.RIGGER_SENIOR,
  StaffCategory.DRIVER,
];

export function getPersonnelCategoriesSpec() {
  return {
    ref: CDC_HR_PERSONNEL_REF,
    groups: CDC_PERSONNEL_GROUPS.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      staffCategories: g.staffCategories,
      specialties: g.specialties?.map((s) => s),
      rules: g.rules,
    })),
  };
}
