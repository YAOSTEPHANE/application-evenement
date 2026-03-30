import type { PrismaClient } from "@prisma/client";
import { MovementType, ReturnCondition, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

/** IDs fixes 24 hex (ObjectId) pour un seed idempotent. */
export const SEED_IDS = {
  organization: "000000000000000000000001",
  userAdmin: "000000000000000000000002",
  userManager: "000000000000000000000003",
  userStorekeeper: "000000000000000000000004",
  userViewer: "000000000000000000000005",
  catMobilier: "000000000000000000000010",
  catAudiovisuel: "000000000000000000000011",
  catVaisselle: "000000000000000000000012",
  catDecoration: "000000000000000000000013",
  catAutre: "000000000000000000000014",
  itemChaise: "000000000000000000000020",
  itemMicro: "000000000000000000000021",
  itemGuirlande: "000000000000000000000022",
  itemNappe: "000000000000000000000023",
  itemSpot: "000000000000000000000024",
  itemHousse: "000000000000000000000025",
  eventReception: "000000000000000000000030",
  eventSeminaire: "000000000000000000000031",
  eiReceptionChaise: "000000000000000000000040",
  eiReceptionMicro: "000000000000000000000041",
  eiReceptionGuirlande: "000000000000000000000042",
  eiSeminaireNappe: "000000000000000000000043",
  eiSeminaireSpot: "000000000000000000000044",
  eiSeminaireHousse: "000000000000000000000045",
  mov1: "000000000000000000000050",
  mov2: "000000000000000000000051",
} as const;

export async function seedDemoData(prisma: PrismaClient) {
  const orgId = SEED_IDS.organization;

  await prisma.organization.upsert({
    where: { id: orgId },
    update: { name: "StockEvent Demo" },
    create: { id: orgId, name: "StockEvent Demo" },
  });

  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "Demo1234!";
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const users = [
    {
      id: SEED_IDS.userAdmin,
      username: "admin",
      email: "admin@stockevent.local",
      fullName: "Admin StockEvent",
      role: Role.ADMIN,
    },
    {
      id: SEED_IDS.userManager,
      username: "aminata",
      email: "manager@stockevent.local",
      fullName: "Aminata Diallo",
      role: Role.MANAGER,
    },
    {
      id: SEED_IDS.userStorekeeper,
      username: "koffi",
      email: "magasinier@stockevent.local",
      fullName: "Koffi N'Guessan",
      role: Role.STOREKEEPER,
    },
    {
      id: SEED_IDS.userViewer,
      username: "sophie",
      email: "lecture@stockevent.local",
      fullName: "Sophie Martin",
      role: Role.VIEWER,
    },
  ] as const;

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        organizationId: orgId,
        username: u.username,
        passwordHash,
      },
      create: {
        id: u.id,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        organizationId: orgId,
        passwordHash,
      },
    });
  }

  const categories = [
    { id: SEED_IDS.catMobilier, name: "Mobilier", slug: "mobilier" },
    { id: SEED_IDS.catAudiovisuel, name: "Audiovisuel", slug: "audiovisuel" },
    { id: SEED_IDS.catVaisselle, name: "Vaisselle", slug: "vaisselle" },
    { id: SEED_IDS.catDecoration, name: "Décoration", slug: "decoration" },
    { id: SEED_IDS.catAutre, name: "Autre", slug: "autre" },
  ] as const;

  for (const c of categories) {
    await prisma.category.upsert({
      // Idempotence : l’unicité réelle est sur (organizationId, slug).
      where: { organizationId_slug: { organizationId: orgId, slug: c.slug } },
      update: { name: c.name, slug: c.slug, organizationId: orgId },
      create: { id: c.id, name: c.name, slug: c.slug, organizationId: orgId },
    });
  }

  type ItemSeed = {
    id: string;
    name: string;
    reference: string;
    categoryId: string;
    unitValue: number;
    totalQuantity: number;
    availableQty: number;
    allocatedQty: number;
    repairQty: number;
    minThreshold: number;
  };

  const items: ItemSeed[] = [
    {
      id: SEED_IDS.itemChaise,
      name: "Chaise Napoléon dorée",
      reference: "MOB-001",
      categoryId: SEED_IDS.catMobilier,
      unitValue: 12000,
      totalQuantity: 150,
      availableQty: 115,
      allocatedQty: 35,
      repairQty: 0,
      minThreshold: 10,
    },
    {
      id: SEED_IDS.itemMicro,
      name: "Micro sans fil Shure",
      reference: "AV-014",
      categoryId: SEED_IDS.catAudiovisuel,
      unitValue: 85000,
      totalQuantity: 24,
      availableQty: 8,
      allocatedQty: 16,
      repairQty: 0,
      minThreshold: 4,
    },
    {
      id: SEED_IDS.itemGuirlande,
      name: "Guirlande LED 30m",
      reference: "DEC-022",
      categoryId: SEED_IDS.catDecoration,
      unitValue: 18500,
      totalQuantity: 40,
      availableQty: 2,
      allocatedQty: 38,
      repairQty: 0,
      minThreshold: 10,
    },
    {
      id: SEED_IDS.itemNappe,
      name: "Nappe ronde blanc 240cm",
      reference: "VAI-008",
      categoryId: SEED_IDS.catVaisselle,
      unitValue: 4500,
      totalQuantity: 60,
      availableQty: 50,
      allocatedQty: 10,
      repairQty: 0,
      minThreshold: 8,
    },
    {
      id: SEED_IDS.itemSpot,
      name: "Projecteur LED 200W",
      reference: "ECL-003",
      categoryId: SEED_IDS.catAutre,
      unitValue: 62000,
      totalQuantity: 35,
      availableQty: 30,
      allocatedQty: 5,
      repairQty: 0,
      minThreshold: 6,
    },
    {
      id: SEED_IDS.itemHousse,
      name: "Housse stretch noire",
      reference: "TXT-011",
      categoryId: SEED_IDS.catAutre,
      unitValue: 3200,
      totalQuantity: 80,
      availableQty: 75,
      allocatedQty: 5,
      repairQty: 0,
      minThreshold: 12,
    },
  ];

  for (const it of items) {
    await prisma.item.upsert({
      // Idempotence : l’unicité réelle est sur (organizationId, reference).
      where: { organizationId_reference: { organizationId: orgId, reference: it.reference } },
      update: {
        name: it.name,
        reference: it.reference,
        categoryId: it.categoryId,
        unitValue: it.unitValue,
        totalQuantity: it.totalQuantity,
        availableQty: it.availableQty,
        allocatedQty: it.allocatedQty,
        repairQty: it.repairQty,
        minThreshold: it.minThreshold,
        organizationId: orgId,
      },
      create: {
        id: it.id,
        name: it.name,
        reference: it.reference,
        categoryId: it.categoryId,
        unitValue: it.unitValue,
        totalQuantity: it.totalQuantity,
        availableQty: it.availableQty,
        allocatedQty: it.allocatedQty,
        repairQty: it.repairQty,
        minThreshold: it.minThreshold,
        organizationId: orgId,
      },
    });
  }

  const now = new Date();
  const eventReceptionStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 14, 0, 0);
  const eventReceptionEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 0, 0);
  const eventSemStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 21, 9, 0, 0);
  const eventSemEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 21, 18, 0, 0);

  await prisma.event.upsert({
    where: { id: SEED_IDS.eventReception },
    update: {
      name: "Réception — Famille Traoré",
      location: "Résidence Les Palmiers, Cocody",
      clientName: "Famille Traoré",
      startsAt: eventReceptionStart,
      endsAt: eventReceptionEnd,
      ownerId: SEED_IDS.userAdmin,
      organizationId: orgId,
    },
    create: {
      id: SEED_IDS.eventReception,
      name: "Réception — Famille Traoré",
      location: "Résidence Les Palmiers, Cocody",
      clientName: "Famille Traoré",
      startsAt: eventReceptionStart,
      endsAt: eventReceptionEnd,
      ownerId: SEED_IDS.userAdmin,
      organizationId: orgId,
    },
  });

  await prisma.event.upsert({
    where: { id: SEED_IDS.eventSeminaire },
    update: {
      name: "Séminaire Tech Corp CI",
      location: "Hôtel Ivoire, Abidjan",
      clientName: "Tech Corp CI",
      startsAt: eventSemStart,
      endsAt: eventSemEnd,
      ownerId: SEED_IDS.userManager,
      organizationId: orgId,
    },
    create: {
      id: SEED_IDS.eventSeminaire,
      name: "Séminaire Tech Corp CI",
      location: "Hôtel Ivoire, Abidjan",
      clientName: "Tech Corp CI",
      startsAt: eventSemStart,
      endsAt: eventSemEnd,
      ownerId: SEED_IDS.userManager,
      organizationId: orgId,
    },
  });

  const eventItems: Array<{
    id: string;
    eventId: string;
    itemId: string;
    quantity: number;
  }> = [
    { id: SEED_IDS.eiReceptionChaise, eventId: SEED_IDS.eventReception, itemId: SEED_IDS.itemChaise, quantity: 35 },
    { id: SEED_IDS.eiReceptionMicro, eventId: SEED_IDS.eventReception, itemId: SEED_IDS.itemMicro, quantity: 16 },
    { id: SEED_IDS.eiReceptionGuirlande, eventId: SEED_IDS.eventReception, itemId: SEED_IDS.itemGuirlande, quantity: 38 },
    { id: SEED_IDS.eiSeminaireNappe, eventId: SEED_IDS.eventSeminaire, itemId: SEED_IDS.itemNappe, quantity: 10 },
    { id: SEED_IDS.eiSeminaireSpot, eventId: SEED_IDS.eventSeminaire, itemId: SEED_IDS.itemSpot, quantity: 5 },
    { id: SEED_IDS.eiSeminaireHousse, eventId: SEED_IDS.eventSeminaire, itemId: SEED_IDS.itemHousse, quantity: 5 },
  ];

  for (const ei of eventItems) {
    await prisma.eventItem.upsert({
      where: {
        eventId_itemId: { eventId: ei.eventId, itemId: ei.itemId },
      },
      update: { quantity: ei.quantity },
      create: {
        id: ei.id,
        eventId: ei.eventId,
        itemId: ei.itemId,
        quantity: ei.quantity,
      },
    });
  }

  const movDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  await prisma.stockMovement.upsert({
    where: { id: SEED_IDS.mov1 },
    update: {},
    create: {
      id: SEED_IDS.mov1,
      movementType: MovementType.OUTBOUND,
      quantity: 5,
      notes: "Préparation tournée magasin",
      organizationId: orgId,
      itemId: SEED_IDS.itemChaise,
      eventId: SEED_IDS.eventReception,
      actorId: SEED_IDS.userStorekeeper,
      createdAt: movDate,
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: SEED_IDS.mov2 },
    update: {},
    create: {
      id: SEED_IDS.mov2,
      movementType: MovementType.RETURN,
      quantity: 2,
      returnCondition: ReturnCondition.OK,
      notes: "Retour fin de prestation (test)",
      organizationId: orgId,
      itemId: SEED_IDS.itemMicro,
      eventId: SEED_IDS.eventReception,
      actorId: SEED_IDS.userStorekeeper,
      createdAt: new Date(movDate.getTime() + 60 * 60 * 1000),
    },
  });

  const counts = {
    users: await prisma.user.count({ where: { organizationId: orgId } }),
    categories: await prisma.category.count({ where: { organizationId: orgId } }),
    items: await prisma.item.count({ where: { organizationId: orgId } }),
    events: await prisma.event.count({ where: { organizationId: orgId } }),
    eventItems: await prisma.eventItem.count({
      where: { event: { organizationId: orgId } },
    }),
    movements: await prisma.stockMovement.count({ where: { organizationId: orgId } }),
  };

  return { organizationId: orgId, counts };
}
