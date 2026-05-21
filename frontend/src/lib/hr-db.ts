import { Role, StaffCategory, StaffSpecialty, VehicleStatus, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

import {
  canBeDesignatedTeamLeader,
  categoryAllowsSpecialties,
  categoryRequiresVehicle,
  defaultAppRoleForStaffCategory,
  getPersonnelCategoriesSpec,
  STAFF_MEMBER_APP_ROLES,
} from "@/lib/cdc-hr-personnel";
import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification-db";

export { getPersonnelCategoriesSpec };

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

export class HrDbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HrDbError";
  }
}

export function assertHrStaffAdmin(role: Role | null | undefined, actorId?: string | null) {
  if (!actorId) {
    throw new HrDbError("Non authentifié.", 401);
  }
  if (role !== Role.ADMIN) {
    throw new HrDbError("Seuls les administrateurs peuvent gérer le personnel.", 403);
  }
}

const staffProfileInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      active: true,
      vehicleAsDriver: {
        select: { id: true, label: true, plateNumber: true, status: true },
      },
    },
  },
} as const;

export async function listStaffProfiles(organizationId: string) {
  const profiles = await prisma.staffProfile.findMany({
    where: { organizationId },
    include: staffProfileInclude,
    orderBy: { createdAt: "desc" },
  });
  return profiles;
}

export const upsertStaffProfileSchema = z.object({
  userId: objectId,
  category: z.nativeEnum(StaffCategory),
  specialties: z.array(z.nativeEnum(StaffSpecialty)).default([]),
  vehicleId: objectId.optional().nullable(),
  unavailable: z.boolean().optional(),
  unavailableUntil: z.string().datetime().optional(),
});

export const createStaffMemberSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Lettres, chiffres, point, tiret ou underscore uniquement"),
  email: z.email(),
  fullName: z.string().min(2).max(120),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  role: z.nativeEnum(Role).optional(),
  category: z.nativeEnum(StaffCategory),
  specialties: z.array(z.nativeEnum(StaffSpecialty)).default([]),
  vehicleId: objectId.optional().nullable(),
  unavailable: z.boolean().optional(),
  unavailableUntil: z.string().datetime().optional(),
});

function validateStaffCategoryPayload(
  category: StaffCategory,
  specialties: StaffSpecialty[],
  vehicleId: string | null | undefined,
) {
  if (category === StaffCategory.DAY_LABORER) {
    throw new HrDbError(
      "Les journaliers se déclarent dans l'onglet Journaliers (présence du matin).",
      400,
    );
  }
  const normalizedSpecs = categoryAllowsSpecialties(category) ? specialties : [];
  if (categoryRequiresVehicle(category) && !vehicleId) {
    throw new HrDbError("Chauffeur : sélectionnez un véhicule du parc.", 400);
  }
  return normalizedSpecs;
}

async function syncDriverVehicle(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  category: StaffCategory,
  vehicleId: string | null | undefined,
) {
  await tx.vehicle.updateMany({
    where: { organizationId, driverUserId: userId },
    data: { driverUserId: null },
  });

  if (category !== StaffCategory.DRIVER) return;

  if (!vehicleId) {
    throw new HrDbError("Chauffeur : rattachement à un véhicule du parc obligatoire.", 400);
  }

  const vehicle = await tx.vehicle.findFirst({
    where: { id: vehicleId, organizationId, active: true },
  });
  if (!vehicle) {
    throw new HrDbError("Véhicule introuvable ou inactif", 404);
  }

  if (vehicle.driverUserId && vehicle.driverUserId !== userId) {
    throw new HrDbError(
      "Ce véhicule est déjà rattaché à un autre chauffeur. Libérez-le avant réassignation.",
      409,
    );
  }

  await tx.vehicle.update({
    where: { id: vehicleId },
    data: { driverUserId: userId },
  });
}

export async function upsertStaffProfile(organizationId: string, raw: unknown) {
  const payload = upsertStaffProfileSchema.parse(raw);
  const specialties = validateStaffCategoryPayload(
    payload.category,
    payload.specialties,
    payload.vehicleId,
  );

  const user = await prisma.user.findFirst({
    where: { id: payload.userId, organizationId },
  });
  if (!user) {
    throw new HrDbError("Utilisateur introuvable", 404);
  }

  const existingProfile = await prisma.staffProfile.findUnique({
    where: { userId: payload.userId },
  });
  if (existingProfile && existingProfile.organizationId !== organizationId) {
    throw new HrDbError("Profil terrain introuvable", 404);
  }

  return prisma.$transaction(async (tx) => {
    await syncDriverVehicle(tx, organizationId, payload.userId, payload.category, payload.vehicleId);

    return tx.staffProfile.upsert({
      where: { userId: payload.userId },
      create: {
        organizationId,
        userId: payload.userId,
        category: payload.category,
        specialties,
        unavailable: payload.unavailable ?? false,
        unavailableUntil: payload.unavailableUntil ? new Date(payload.unavailableUntil) : null,
      },
      update: {
        category: payload.category,
        specialties,
        unavailable: payload.unavailable ?? false,
        unavailableUntil: payload.unavailableUntil ? new Date(payload.unavailableUntil) : null,
      },
      include: staffProfileInclude,
    });
  });
}

export async function createStaffMember(organizationId: string, raw: unknown) {
  const payload = createStaffMemberSchema.parse(raw);
  const specialties = validateStaffCategoryPayload(
    payload.category,
    payload.specialties,
    payload.vehicleId,
  );

  const appRole = payload.role ?? defaultAppRoleForStaffCategory(payload.category);
  if (!STAFF_MEMBER_APP_ROLES.includes(appRole)) {
    throw new HrDbError(
      "Rôle applicatif non autorisé pour un membre du personnel terrain.",
      400,
    );
  }

  const usernameLower = payload.username.trim().toLowerCase();
  const emailLower = payload.email.trim().toLowerCase();

  const dupUser = await prisma.user.findFirst({
    where: { organizationId, username: usernameLower },
  });
  if (dupUser) {
    throw new HrDbError("Ce nom d'utilisateur est déjà pris.", 409);
  }

  const passwordHash = await bcrypt.hash(payload.password, 10);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId,
          username: usernameLower,
          email: emailLower,
          fullName: payload.fullName.trim(),
          role: appRole,
          passwordHash,
          active: true,
        },
      });

      await syncDriverVehicle(
        tx,
        organizationId,
        user.id,
        payload.category,
        payload.vehicleId,
      );

      return tx.staffProfile.create({
        data: {
          organizationId,
          userId: user.id,
          category: payload.category,
          specialties,
          unavailable: payload.unavailable ?? false,
          unavailableUntil: payload.unavailableUntil ? new Date(payload.unavailableUntil) : null,
        },
        include: staffProfileInclude,
      });
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new HrDbError("Cet email est déjà utilisé.", 409);
    }
    throw error;
  }
}

export function isLinkStaffPayload(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const userId = (raw as { userId?: unknown }).userId;
  return typeof userId === "string" && userId.length > 0;
}

export async function listVehicles(organizationId: string) {
  return prisma.vehicle.findMany({
    where: { organizationId },
    include: {
      driver: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { label: "asc" },
  });
}

export const vehicleSchema = z.object({
  label: z.string().min(1).max(80),
  plateNumber: z.string().min(2).max(20),
  capacityNotes: z.string().max(200).optional(),
  status: z.nativeEnum(VehicleStatus).optional(),
  active: z.boolean().optional(),
});

export async function createVehicle(organizationId: string, raw: unknown) {
  const payload = vehicleSchema.parse(raw);
  return prisma.vehicle.create({
    data: {
      organizationId,
      label: payload.label,
      plateNumber: payload.plateNumber.toUpperCase(),
      capacityNotes: payload.capacityNotes,
      status: payload.status ?? VehicleStatus.AVAILABLE,
      active: payload.active ?? true,
    },
  });
}

export async function listProjectAssignments(organizationId: string, eventId?: string) {
  return prisma.projectAssignment.findMany({
    where: { organizationId, ...(eventId ? { eventId } : {}) },
    include: {
      user: { select: { id: true, fullName: true, role: true } },
      event: { select: { id: true, name: true, startsAt: true, endsAt: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
}

export const assignmentSchema = z.object({
  eventId: objectId,
  userId: objectId,
  isTeamLeader: z.boolean().default(false),
});

export async function assignToProject(organizationId: string, raw: unknown) {
  const payload = assignmentSchema.parse(raw);
  const event = await prisma.event.findFirst({
    where: { id: payload.eventId, organizationId },
  });
  if (!event) {
    throw new HrDbError("Commande / événement introuvable", 404);
  }

  if (payload.isTeamLeader) {
    const profile = await prisma.staffProfile.findFirst({
      where: { userId: payload.userId, organizationId },
    });
    if (!canBeDesignatedTeamLeader(profile?.category)) {
      throw new HrDbError(
        "Chef d'équipe : désignation réservée aux monteurs seniors ou au profil chef d'équipe.",
        400,
      );
    }
  }

  const assignment = await prisma.$transaction(async (tx) => {
    if (payload.isTeamLeader) {
      await tx.projectAssignment.updateMany({
        where: {
          eventId: payload.eventId,
          isTeamLeader: true,
          userId: { not: payload.userId },
        },
        data: { isTeamLeader: false },
      });
      await tx.event.update({
        where: { id: payload.eventId },
        data: { teamLeaderId: payload.userId },
      });
    } else {
      const existingLeader = await tx.projectAssignment.findFirst({
        where: { eventId: payload.eventId, userId: payload.userId, isTeamLeader: true },
      });
      if (existingLeader) {
        await tx.event.update({
          where: { id: payload.eventId },
          data: { teamLeaderId: null },
        });
      }
    }

    return tx.projectAssignment.upsert({
      where: { eventId_userId: { eventId: payload.eventId, userId: payload.userId } },
      create: {
        organizationId,
        eventId: payload.eventId,
        userId: payload.userId,
        isTeamLeader: payload.isTeamLeader,
      },
      update: { isTeamLeader: payload.isTeamLeader },
      include: { user: true, event: true },
    });
  });

  await createNotification(prisma, {
    organizationId,
    userId: payload.userId,
    module: "rh",
    title: "Affectation projet",
    body: `Vous êtes affecté à : ${event.name}`,
    targetType: "Event",
    targetId: event.id,
    severity: "INFO",
  });

  return assignment;
}

export async function listDailyWorkers(organizationId: string, from?: Date, to?: Date) {
  return prisma.dailyWorkerEntry.findMany({
    where: {
      organizationId,
      ...(from || to
        ? {
            workDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    include: { event: { select: { id: true, name: true } } },
    orderBy: { workDate: "desc" },
    take: 200,
  });
}

export const dailyWorkerSchema = z.object({
  workDate: z.string(),
  fullName: z.string().min(2).max(120),
  eventId: objectId.optional(),
  notes: z.string().max(300).optional(),
  hoursWorked: z.number().positive().max(24).optional(),
  dailyRate: z.number().nonnegative().optional(),
  accountCode: z.string().max(32).optional(),
  /** Présence du matin (§9.1) — true par défaut à la saisie. */
  morningPresence: z.boolean().optional(),
});

function morningDeclarationTimestamp(workDateIso: string): Date {
  const d = new Date(workDateIso);
  const now = new Date();
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return now;
  }
  d.setHours(7, 0, 0, 0);
  return d;
}

export async function createDailyWorker(organizationId: string, raw: unknown) {
  const payload = dailyWorkerSchema.parse(raw);
  const declareMorning = payload.morningPresence !== false;
  return prisma.dailyWorkerEntry.create({
    data: {
      organizationId,
      workDate: new Date(payload.workDate),
      fullName: payload.fullName,
      eventId: payload.eventId,
      notes: payload.notes,
      hoursWorked: payload.hoursWorked ?? 8,
      dailyRate: payload.dailyRate ?? 0,
      accountCode: payload.accountCode ?? "622",
      morningDeclaredAt: declareMorning
        ? morningDeclarationTimestamp(payload.workDate)
        : null,
    },
  });
}

export async function staffOccupancyRate(organizationId: string) {
  const [total, assigned, leaders] = await Promise.all([
    prisma.staffProfile.count({ where: { organizationId, unavailable: false } }),
    prisma.projectAssignment.findMany({
      where: { organizationId },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.staffProfile.count({
      where: { organizationId, category: StaffCategory.TEAM_LEADER, unavailable: false },
    }),
  ]);
  const occupied = assigned.length;
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  return { total, occupied, pct, teamLeadersTotal: leaders };
}

export type HrStats = {
  staffTotal: number;
  staffOccupied: number;
  staffOccupancyPct: number;
  teamLeadersTotal: number;
  riggersTotal: number;
  driversTotal: number;
  driversWithVehicle: number;
  staffUnavailable: number;
  vehiclesTotal: number;
  vehiclesAvailable: number;
  vehiclesInUse: number;
  assignmentsTotal: number;
  eventsWithCrew: number;
  dailyWorkersMonth: number;
  dailyDeclaredToday: number;
  dailyPendingPayroll: number;
};

export async function getHrStats(organizationId: string): Promise<HrStats> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const occupancy = await staffOccupancyRate(organizationId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [
    staffUnavailable,
    riggersTotal,
    driversTotal,
    driversWithVehicle,
    vehiclesTotal,
    vehiclesAvailable,
    vehiclesInUse,
    assignmentsTotal,
    eventsWithCrew,
    dailyWorkersMonth,
    dailyDeclaredToday,
    dailyPendingPayroll,
  ] = await Promise.all([
    prisma.staffProfile.count({ where: { organizationId, unavailable: true } }),
    prisma.staffProfile.count({
      where: {
        organizationId,
        category: {
          in: [
            StaffCategory.RIGGER_JUNIOR,
            StaffCategory.RIGGER_CONFIRMED,
            StaffCategory.RIGGER_SENIOR,
          ],
        },
      },
    }),
    prisma.staffProfile.count({
      where: { organizationId, category: StaffCategory.DRIVER },
    }),
    prisma.vehicle.count({
      where: { organizationId, active: true, driverUserId: { not: null } },
    }),
    prisma.vehicle.count({ where: { organizationId, active: true } }),
    prisma.vehicle.count({
      where: { organizationId, active: true, status: VehicleStatus.AVAILABLE },
    }),
    prisma.vehicle.count({
      where: { organizationId, active: true, status: VehicleStatus.IN_USE },
    }),
    prisma.projectAssignment.count({ where: { organizationId } }),
    prisma.projectAssignment.findMany({
      where: { organizationId },
      distinct: ["eventId"],
      select: { eventId: true },
    }).then((r) => r.length),
    prisma.dailyWorkerEntry.count({
      where: { organizationId, workDate: { gte: monthStart } },
    }),
    prisma.dailyWorkerEntry.count({
      where: { organizationId, sentToPayroll: false, workDate: { gte: monthStart } },
    }),
    prisma.dailyWorkerEntry.count({
      where: {
        organizationId,
        workDate: { gte: todayStart, lt: todayEnd },
        morningDeclaredAt: { not: null },
      },
    }),
  ]);

  return {
    staffTotal: occupancy.total,
    staffOccupied: occupancy.occupied,
    staffOccupancyPct: occupancy.pct,
    teamLeadersTotal: occupancy.teamLeadersTotal,
    riggersTotal,
    driversTotal,
    driversWithVehicle,
    staffUnavailable,
    vehiclesTotal,
    vehiclesAvailable,
    vehiclesInUse,
    assignmentsTotal,
    eventsWithCrew,
    dailyWorkersMonth,
    dailyDeclaredToday,
    dailyPendingPayroll,
  };
}

export const patchVehicleSchema = z.object({
  id: objectId,
  label: z.string().min(1).max(80).optional(),
  plateNumber: z.string().min(2).max(20).optional(),
  capacityNotes: z.string().max(200).optional(),
  status: z.nativeEnum(VehicleStatus).optional(),
  active: z.boolean().optional(),
  driverUserId: objectId.nullable().optional(),
});

export async function patchVehicle(organizationId: string, raw: unknown) {
  const payload = patchVehicleSchema.parse(raw);
  const existing = await prisma.vehicle.findFirst({
    where: { id: payload.id, organizationId },
  });
  if (!existing) {
    throw new HrDbError("Véhicule introuvable", 404);
  }
  if (payload.driverUserId !== undefined && payload.driverUserId !== null) {
    const driverProfile = await prisma.staffProfile.findFirst({
      where: { userId: payload.driverUserId, organizationId, category: StaffCategory.DRIVER },
    });
    if (!driverProfile) {
      throw new HrDbError("Le chauffeur doit avoir un profil « Chauffeur ».", 400);
    }
  }

  return prisma.$transaction(async (tx) => {
    if (payload.driverUserId !== undefined) {
      if (payload.driverUserId === null) {
        await tx.vehicle.updateMany({
          where: { id: payload.id },
          data: { driverUserId: null },
        });
      } else {
        await tx.vehicle.updateMany({
          where: { organizationId, driverUserId: payload.driverUserId, id: { not: payload.id } },
          data: { driverUserId: null },
        });
      }
    }

    return tx.vehicle.update({
      where: { id: payload.id },
      data: {
        ...(payload.label !== undefined ? { label: payload.label } : {}),
        ...(payload.plateNumber !== undefined
          ? { plateNumber: payload.plateNumber.toUpperCase() }
          : {}),
        ...(payload.capacityNotes !== undefined ? { capacityNotes: payload.capacityNotes } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.active !== undefined ? { active: payload.active } : {}),
        ...(payload.driverUserId !== undefined ? { driverUserId: payload.driverUserId } : {}),
      },
      include: { driver: { select: { id: true, fullName: true } } },
    });
  });
}
