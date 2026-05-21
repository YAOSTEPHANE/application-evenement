import type { PrismaClient } from "@prisma/client";
import {
  BeSubtype,
  BsSubtype,
  EventLifecycle,
  MovementReason,
  MovementType,
  OrderStatus,
  ReturnCondition,
  RfidTagType,
  Role,
  StaffCategory,
  StockDocumentKind,
  StockDocumentStatus,
  TrackedAssetStatus,
  VehicleStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { formatTagCode } from "./tag-nomenclature";

/** IDs fixes 24 hex (ObjectId) pour un seed idempotent. */
export const SEED_IDS = {
  organization: "000000000000000000000001",
  userAdmin: "000000000000000000000002",
  userManager: "000000000000000000000003",
  userStorekeeper: "000000000000000000000004",
  userViewer: "000000000000000000000005",
  userTechnician: "000000000000000000000006",
  catMobilier: "000000000000000000000010",
  catAudiovisuel: "000000000000000000000011",
  catVaisselle: "000000000000000000000012",
  catDecoration: "000000000000000000000013",
  catAutre: "000000000000000000000014",
  catMobChaise: "000000000000000000000060",
  catAudMicro: "000000000000000000000061",
  catAutEcl: "000000000000000000000062",
  catMobNap: "000000000000000000000063",
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
  whPrincipal: "000000000000000000000070",
  whMagasin: "000000000000000000000071",
  portalSortie: "000000000000000000000090",
  portalEntree: "000000000000000000000091",
  handheldStock: "000000000000000000000092",
  handheldTerrain: "000000000000000000000093",
  zoneReception: "000000000000000000000072",
  zonePicking: "000000000000000000000073",
  zoneShelving: "000000000000000000000074",
  zoneReturn: "000000000000000000000075",
  shelfAisle: "000000000000000000000080",
  shelfRack: "000000000000000000000081",
  shelfShelf: "000000000000000000000082",
  shelfBin: "000000000000000000000083",
  locA123: "000000000000000000000084",
  locStockChaise: "000000000000000000000085",
  mov2: "000000000000000000000051",
  mov3: "000000000000000000000052",
  mov4: "000000000000000000000053",
  mov5: "000000000000000000000054",
  tagChaise1: "0000000000000000000000a0",
  docBs1: "0000000000000000000000a1",
  docLine1: "0000000000000000000000a2",
  vehicle1: "000000000000000000000097",
  docSeqBs: "000000000000000000000094",
  assignReception: "0000000000000000000000a4",
  assignSeminaire: "0000000000000000000000a5",
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
      active: true,
    },
    {
      id: SEED_IDS.userManager,
      username: "aminata",
      email: "manager@stockevent.local",
      fullName: "Aminata Diallo",
      role: Role.MANAGER,
      active: true,
    },
    {
      id: SEED_IDS.userStorekeeper,
      username: "koffi",
      email: "magasinier@stockevent.local",
      fullName: "Koffi N'Guessan",
      role: Role.STOREKEEPER,
      active: true,
    },
    {
      id: SEED_IDS.userViewer,
      username: "sophie",
      email: "lecture@stockevent.local",
      fullName: "Sophie Martin",
      role: Role.VIEWER,
      active: false,
    },
    {
      id: SEED_IDS.userTechnician,
      username: "moussa",
      email: "terrain@stockevent.local",
      fullName: "Moussa Koné",
      role: Role.TECHNICIAN,
      active: true,
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
        active: u.active,
      },
      create: {
        id: u.id,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        organizationId: orgId,
        passwordHash,
        active: u.active,
      },
    });
  }

  type CategorySeed = {
    id: string;
    name: string;
    slug: string;
    code: string;
    description?: string;
    icon?: string;
    metadata?: Record<string, string | number | boolean>;
    active?: boolean;
    level: number;
    parentId?: string;
  };

  const categories: CategorySeed[] = [
    {
      id: SEED_IDS.catMobilier,
      name: "Mobilier",
      slug: "mobilier",
      code: "MOB",
      description: "Chaises, tables, mobilier événementiel",
      icon: "🪑",
      metadata: { secteur: "reception", stockage: "rack-A" },
      level: 0,
    },
    {
      id: SEED_IDS.catMobChaise,
      name: "Chaises",
      slug: "chaises",
      code: "MOB-CHR",
      description: "Chaises pliantes, napoléon, bistrot",
      icon: "💺",
      parentId: SEED_IDS.catMobilier,
      level: 1,
    },
    {
      id: SEED_IDS.catMobNap,
      name: "Napoléon",
      slug: "napoleon",
      code: "MOB-CHR-NAP",
      description: "Chaises napoléon dorées ou blanches",
      icon: "👑",
      parentId: SEED_IDS.catMobChaise,
      level: 2,
    },
    {
      id: SEED_IDS.catAudiovisuel,
      name: "Audiovisuel",
      slug: "audiovisuel",
      code: "AUD",
      description: "Son, lumière, vidéo",
      icon: "🎛️",
      level: 0,
    },
    {
      id: SEED_IDS.catAudMicro,
      name: "Micros & HF",
      slug: "micros",
      code: "AUD-MIC",
      parentId: SEED_IDS.catAudiovisuel,
      level: 1,
    },
    {
      id: SEED_IDS.catVaisselle,
      name: "Vaisselle",
      slug: "vaisselle",
      code: "VAI",
      icon: "🍽️",
      level: 0,
    },
    {
      id: SEED_IDS.catDecoration,
      name: "Décoration",
      slug: "decoration",
      code: "DEC",
      icon: "✨",
      level: 0,
    },
    {
      id: SEED_IDS.catAutre,
      name: "Autre",
      slug: "autre",
      code: "AUT",
      level: 0,
    },
    {
      id: SEED_IDS.catAutEcl,
      name: "Éclairage",
      slug: "eclairage",
      code: "AUT-ECL",
      parentId: SEED_IDS.catAutre,
      level: 1,
    },
  ];

  for (const c of categories) {
    await prisma.category.upsert({
      where: { organizationId_slug: { organizationId: orgId, slug: c.slug } },
      update: {
        name: c.name,
        slug: c.slug,
        code: c.code,
        description: c.description ?? null,
        icon: c.icon ?? null,
        metadata: c.metadata ?? undefined,
        active: c.active ?? true,
        level: c.level,
        parentId: c.parentId ?? null,
        organizationId: orgId,
      },
      create: {
        id: c.id,
        name: c.name,
        slug: c.slug,
        code: c.code,
        description: c.description ?? null,
        icon: c.icon ?? null,
        metadata: c.metadata ?? undefined,
        active: c.active ?? true,
        level: c.level,
        parentId: c.parentId ?? null,
        organizationId: orgId,
      },
    });
  }

  const warehouses = [
    {
      id: SEED_IDS.whPrincipal,
      name: "Entrepôt principal Cocody",
      code: "WH-ABJ-COC",
      kind: "WAREHOUSE" as const,
      address: "Zone industrielle, Angré",
      city: "Abidjan",
      latitude: 5.3599517,
      longitude: -4.0082563,
      totalCapacity: 2500,
      capacityUnit: "unités",
      managerName: "Kouassi Jean",
      managerPhone: "+225 07 00 00 01 01",
      managerEmail: "kouassi@stockevent.local",
      accessHours: "Lun–Ven 7h–19h, Sam 8h–14h",
      specialConditions: ["Climatisé", "Sécurisé 24h/24", "Quai de chargement"],
      notes: "Site principal de stockage mobilier et déco",
    },
    {
      id: SEED_IDS.whMagasin,
      name: "Magasin Plateau — dépôt rapide",
      code: "WH-ABJ-PLT",
      kind: "STORE" as const,
      address: "Rue du Commerce, Plateau",
      city: "Abidjan",
      latitude: 5.322821,
      longitude: -4.017382,
      totalCapacity: 450,
      capacityUnit: "unités",
      managerName: "Traoré Aïcha",
      managerPhone: "+225 07 00 00 02 02",
      accessHours: "Lun–Sam 8h–18h",
      specialConditions: ["Accès véhicule léger", "Alarme"],
    },
  ];

  const rfidPortals = [
    {
      id: SEED_IDS.portalSortie,
      code: "PORTIQUE-ABJ-SORTIE",
      label: "Portique sortie — Cocody",
      locationHint: "Quai expédition, portail nord",
      passageDirection: "EXIT" as const,
      warehouseId: SEED_IDS.whPrincipal,
    },
    {
      id: SEED_IDS.portalEntree,
      code: "PORTIQUE-ABJ-ENTREE",
      label: "Portique entrée — Cocody",
      locationHint: "Réception matériel retour",
      passageDirection: "ENTRY" as const,
      warehouseId: SEED_IDS.whPrincipal,
    },
  ];

  for (const wh of warehouses) {
    await prisma.warehouse.upsert({
      where: { organizationId_code: { organizationId: orgId, code: wh.code } },
      update: {
        name: wh.name,
        kind: wh.kind,
        address: wh.address,
        city: wh.city,
        latitude: wh.latitude,
        longitude: wh.longitude,
        totalCapacity: wh.totalCapacity,
        capacityUnit: wh.capacityUnit,
        managerName: wh.managerName,
        managerPhone: wh.managerPhone,
        managerEmail: wh.managerEmail ?? null,
        accessHours: wh.accessHours,
        specialConditions: wh.specialConditions,
        notes: wh.notes ?? null,
        active: true,
      },
      create: {
        id: wh.id,
        organizationId: orgId,
        name: wh.name,
        code: wh.code,
        kind: wh.kind,
        address: wh.address,
        city: wh.city,
        latitude: wh.latitude,
        longitude: wh.longitude,
        totalCapacity: wh.totalCapacity,
        capacityUnit: wh.capacityUnit,
        managerName: wh.managerName,
        managerPhone: wh.managerPhone,
        managerEmail: wh.managerEmail ?? null,
        accessHours: wh.accessHours,
        specialConditions: wh.specialConditions,
        notes: wh.notes ?? null,
        active: true,
      },
    });
  }

  const rfidHandhelds = [
    {
      id: SEED_IDS.handheldStock,
      code: "DOUCHETTE-STOCK-01",
      label: "Douchette magasin — Cocody",
      serialNumber: "HH-ZEBRA-001",
      warehouseId: SEED_IDS.whPrincipal,
      assignedUserId: SEED_IDS.userStorekeeper,
    },
    {
      id: SEED_IDS.handheldTerrain,
      code: "DOUCHETTE-TERRAIN-01",
      label: "Douchette terrain événements",
      serialNumber: "HH-ZEBRA-002",
      warehouseId: null,
      assignedUserId: SEED_IDS.userTechnician,
    },
  ];

  for (const portal of rfidPortals) {
    await prisma.rfidPortal.upsert({
      where: { organizationId_code: { organizationId: orgId, code: portal.code } },
      update: {
        label: portal.label,
        locationHint: portal.locationHint,
        passageDirection: portal.passageDirection,
        warehouseId: portal.warehouseId,
        active: true,
      },
      create: {
        id: portal.id,
        organizationId: orgId,
        code: portal.code,
        label: portal.label,
        locationHint: portal.locationHint,
        passageDirection: portal.passageDirection,
        warehouseId: portal.warehouseId,
        active: true,
      },
    });
  }

  for (const hh of rfidHandhelds) {
    await prisma.rfidHandheld.upsert({
      where: { organizationId_code: { organizationId: orgId, code: hh.code } },
      update: {
        label: hh.label,
        serialNumber: hh.serialNumber,
        warehouseId: hh.warehouseId,
        assignedUserId: hh.assignedUserId,
        active: true,
      },
      create: {
        id: hh.id,
        organizationId: orgId,
        code: hh.code,
        label: hh.label,
        serialNumber: hh.serialNumber,
        warehouseId: hh.warehouseId,
        assignedUserId: hh.assignedUserId,
        active: true,
      },
    });
  }

  const principalZones = [
    {
      id: SEED_IDS.zoneReception,
      name: "Quai réception",
      code: "COC-REC",
      zoneType: "RECEPTION" as const,
      locationLabel: "Bât. A — quai nord",
      totalCapacity: 400,
      capacityUnit: "unités",
      accessType: "FREE" as const,
      sortOrder: 1,
      notes: "Contrôle qualité à l'arrivée",
    },
    {
      id: SEED_IDS.zonePicking,
      name: "Zone picking",
      code: "COC-PICK",
      zoneType: "PICKING" as const,
      locationLabel: "Allée 2–4",
      totalCapacity: 800,
      capacityUnit: "unités",
      accessType: "RESTRICTED" as const,
      sortOrder: 2,
      notes: "Préparation commandes événements",
    },
    {
      id: SEED_IDS.zoneShelving,
      name: "Rayonnage mobilier",
      code: "COC-SHELF",
      zoneType: "SHELVING" as const,
      locationLabel: "Allée 5–12",
      totalCapacity: 1200,
      capacityUnit: "unités",
      accessType: "FREE" as const,
      sortOrder: 3,
    },
    {
      id: SEED_IDS.zoneReturn,
      name: "Retours & contrôle",
      code: "COC-RET",
      zoneType: "RETURN" as const,
      locationLabel: "Bât. B — fond",
      totalCapacity: 200,
      capacityUnit: "unités",
      accessType: "RESTRICTED" as const,
      sortOrder: 4,
      notes: "Tri et état des retours location",
    },
  ];

  for (const zone of principalZones) {
    await prisma.storageZone.upsert({
      where: {
        warehouseId_code: { warehouseId: SEED_IDS.whPrincipal, code: zone.code },
      },
      update: {
        name: zone.name,
        zoneType: zone.zoneType,
        locationLabel: zone.locationLabel,
        totalCapacity: zone.totalCapacity,
        capacityUnit: zone.capacityUnit,
        accessType: zone.accessType,
        notes: zone.notes ?? null,
        sortOrder: zone.sortOrder,
        active: true,
      },
      create: {
        id: zone.id,
        organizationId: orgId,
        warehouseId: SEED_IDS.whPrincipal,
        name: zone.name,
        code: zone.code,
        zoneType: zone.zoneType,
        locationLabel: zone.locationLabel,
        totalCapacity: zone.totalCapacity,
        capacityUnit: zone.capacityUnit,
        accessType: zone.accessType,
        notes: zone.notes ?? null,
        sortOrder: zone.sortOrder,
        active: true,
      },
    });
  }

  const shelvingTree = [
    {
      id: SEED_IDS.shelfAisle,
      parentId: null as string | null,
      level: "AISLE" as const,
      code: "A",
      label: "Allée A — mobilier",
      coordinate: "A",
      sortOrder: 1,
    },
    {
      id: SEED_IDS.shelfRack,
      parentId: SEED_IDS.shelfAisle,
      level: "RACK" as const,
      code: "1",
      label: "Rack 1",
      coordinate: "A-1",
      materialType: "METAL" as const,
      sortOrder: 1,
    },
    {
      id: SEED_IDS.shelfShelf,
      parentId: SEED_IDS.shelfRack,
      level: "SHELF" as const,
      code: "2",
      label: "Niveau 2",
      coordinate: "A-1-2",
      sortOrder: 1,
    },
    {
      id: SEED_IDS.shelfBin,
      parentId: SEED_IDS.shelfShelf,
      level: "BIN" as const,
      code: "3",
      label: "Emplacement face",
      coordinate: "A-1-2-3",
      weightCapacityKg: 120,
      widthCm: 120,
      heightCm: 180,
      depthCm: 80,
      sortOrder: 1,
    },
  ];

  for (const node of shelvingTree) {
    await prisma.shelvingNode.upsert({
      where: {
        storageZoneId_coordinate: {
          storageZoneId: SEED_IDS.zoneShelving,
          coordinate: node.coordinate,
        },
      },
      update: {
        parentId: node.parentId,
        level: node.level,
        code: node.code,
        label: node.label,
        materialType: "materialType" in node ? node.materialType : null,
        weightCapacityKg: "weightCapacityKg" in node ? node.weightCapacityKg : null,
        widthCm: "widthCm" in node ? node.widthCm : null,
        heightCm: "heightCm" in node ? node.heightCm : null,
        depthCm: "depthCm" in node ? node.depthCm : null,
        sortOrder: node.sortOrder,
        active: true,
      },
      create: {
        id: node.id,
        organizationId: orgId,
        storageZoneId: SEED_IDS.zoneShelving,
        parentId: node.parentId,
        level: node.level,
        code: node.code,
        label: node.label,
        coordinate: node.coordinate,
        materialType: "materialType" in node ? node.materialType : null,
        weightCapacityKg: "weightCapacityKg" in node ? node.weightCapacityKg : null,
        widthCm: "widthCm" in node ? node.widthCm : null,
        heightCm: "heightCm" in node ? node.heightCm : null,
        depthCm: "depthCm" in node ? node.depthCm : null,
        sortOrder: node.sortOrder,
        active: true,
      },
    });
  }

  await prisma.storageLocation.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "LOC-WH-ABJ-COC-A-1-2-3" } },
    update: {
      label: "Face allée — chaises",
      hierarchyCoordinate: "A-1-2-3",
      latitude: 5.35995,
      longitude: -4.00825,
      maxWeightKg: 120,
      maxVolumeM3: 1.8,
      maxItemCount: 48,
      fillState: "PARTIAL",
      minTempC: 18,
      maxTempC: 26,
      humidityPercent: 55,
      accessHeightCm: 180,
      accessWidthCm: 120,
      specialConditions: ["Pas de charge lourde au-dessus"],
      active: true,
    },
    create: {
      id: SEED_IDS.locA123,
      organizationId: orgId,
      warehouseId: SEED_IDS.whPrincipal,
      storageZoneId: SEED_IDS.zoneShelving,
      shelvingNodeId: SEED_IDS.shelfBin,
      code: "LOC-WH-ABJ-COC-A-1-2-3",
      label: "Face allée — chaises",
      hierarchyCoordinate: "A-1-2-3",
      latitude: 5.35995,
      longitude: -4.00825,
      maxWeightKg: 120,
      maxVolumeM3: 1.8,
      maxItemCount: 48,
      fillState: "PARTIAL",
      minTempC: 18,
      maxTempC: 26,
      humidityPercent: 55,
      accessHeightCm: 180,
      accessWidthCm: 120,
      specialConditions: ["Pas de charge lourde au-dessus"],
      active: true,
      sortOrder: 1,
    },
  });

  type ItemSeed = {
    id: string;
    name: string;
    reference: string;
    categoryId: string;
    emoji: string;
    notes: string;
    description?: string;
    brand?: string;
    model?: string;
    variant?: string;
    barcode?: string;
    supplierName?: string;
    rentalPrice?: number;
    salePrice?: number;
    usefulLifeMonths?: number;
    condition?: "NEW" | "GOOD" | "NEEDS_REPAIR" | "OBSOLETE";
    customFields?: Record<string, string | number | boolean>;
    technicalParams?: string;
    certifications?: string[];
    safetyStandards?: string[];
    specialInstructions?: string;
    unitValue: number;
    totalQuantity: number;
    availableQty: number;
    allocatedQty: number;
    repairQty: number;
    minThreshold: number;
    maxStockQty?: number;
    safetyStockQty?: number;
    optimalStockQty?: number;
    alertThresholdQty?: number;
    criticalThresholdQty?: number;
  };

  function itemLevelFields(it: ItemSeed) {
    return {
      minThreshold: it.minThreshold,
      maxStockQty: it.maxStockQty ?? 0,
      safetyStockQty: it.safetyStockQty ?? 0,
      optimalStockQty: it.optimalStockQty ?? 0,
      alertThresholdQty: it.alertThresholdQty ?? 0,
      criticalThresholdQty: it.criticalThresholdQty ?? 0,
    };
  }

  const items: ItemSeed[] = [
    {
      id: SEED_IDS.itemChaise,
      name: "Chaise Napoléon dorée",
      reference: "MOB-CHR-NAP-001",
      categoryId: SEED_IDS.catMobNap,
      emoji: "🪑",
      description: "Chaise empilable style Napoléon, finition dorée, assise rembourrée.",
      brand: "Déco Plus CI",
      model: "Napoléon III",
      variant: "Or / assise ivoire",
      barcode: "3760123456789",
      supplierName: "Déco Plus CI",
      rentalPrice: 3500,
      salePrice: 45000,
      usefulLifeMonths: 60,
      condition: "GOOD",
      notes: "Contrôle visuel avant chaque sortie",
      customFields: {
        "Charge max": "120 kg",
        Empilable: true,
        Finition: "dorée",
      },
      technicalParams:
        "Structure acier, assise rembourrée 4 cm, hauteur assise 46 cm, empilage max 12 unités.",
      certifications: ["CE", "NF Mobilier événementiel"],
      safetyStandards: ["EN 581-3", "Résistance au feu M2"],
      specialInstructions:
        "Ne pas exposer à la pluie prolongée. Manutention à deux personnes au-delà de 8 chaises empilées.",
      unitValue: 12000,
      totalQuantity: 150,
      availableQty: 115,
      allocatedQty: 35,
      repairQty: 0,
      minThreshold: 20,
      maxStockQty: 180,
      safetyStockQty: 25,
      optimalStockQty: 80,
      alertThresholdQty: 12,
      criticalThresholdQty: 5,
    },
    {
      id: SEED_IDS.itemMicro,
      name: "Micro sans fil Shure",
      reference: "AV-014",
      categoryId: SEED_IDS.catAudMicro,
      emoji: "🎤",
      notes: "Modèle BLX288/PG58",
      customFields: { Fréquence: "2.4 GHz", Canaux: 2 },
      technicalParams: "Récepteur BLX88, 2 micros main PG58, portée ~90 m.",
      certifications: ["CE", "FCC"],
      safetyStandards: ["IEC 60065"],
      specialInstructions: "Vérifier piles et antennes avant chaque événement.",
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
      emoji: "✨",
      notes: "Blanc chaud 3000K",
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
      emoji: "🍽️",
      notes: "Lavage à 60°C",
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
      categoryId: SEED_IDS.catAutEcl,
      emoji: "💡",
      notes: "RGB 150W",
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
      emoji: "🧵",
      notes: "Laize 3m",
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
      // Idempotence sur l’id seed (évite P2002 si la référence a changé entre deux seeds).
      where: { id: it.id },
      update: {
        name: it.name,
        reference: it.reference,
        categoryId: it.categoryId,
        emoji: it.emoji,
        notes: it.notes,
        description: it.description ?? null,
        brand: it.brand ?? null,
        model: it.model ?? null,
        variant: it.variant ?? null,
        barcode: it.barcode ?? null,
        supplierName: it.supplierName ?? null,
        rentalPrice: it.rentalPrice ?? null,
        salePrice: it.salePrice ?? null,
        usefulLifeMonths: it.usefulLifeMonths ?? null,
        condition: it.condition ?? "GOOD",
        customFields: it.customFields ?? null,
        technicalParams: it.technicalParams ?? null,
        certifications: it.certifications ?? [],
        safetyStandards: it.safetyStandards ?? [],
        specialInstructions: it.specialInstructions ?? null,
        unitValue: it.unitValue,
        totalQuantity: it.totalQuantity,
        availableQty: it.availableQty,
        allocatedQty: it.allocatedQty,
        repairQty: it.repairQty,
        ...itemLevelFields(it),
        organizationId: orgId,
      },
      create: {
        id: it.id,
        name: it.name,
        reference: it.reference,
        categoryId: it.categoryId,
        emoji: it.emoji,
        notes: it.notes,
        description: it.description ?? null,
        brand: it.brand ?? null,
        model: it.model ?? null,
        variant: it.variant ?? null,
        barcode: it.barcode ?? null,
        supplierName: it.supplierName ?? null,
        rentalPrice: it.rentalPrice ?? null,
        salePrice: it.salePrice ?? null,
        usefulLifeMonths: it.usefulLifeMonths ?? null,
        condition: it.condition ?? "GOOD",
        customFields: it.customFields ?? null,
        technicalParams: it.technicalParams ?? null,
        certifications: it.certifications ?? [],
        safetyStandards: it.safetyStandards ?? [],
        specialInstructions: it.specialInstructions ?? null,
        unitValue: it.unitValue,
        totalQuantity: it.totalQuantity,
        availableQty: it.availableQty,
        allocatedQty: it.allocatedQty,
        repairQty: it.repairQty,
        ...itemLevelFields(it),
        organizationId: orgId,
      },
    });
  }

  await prisma.item.update({
    where: { id: SEED_IDS.itemChaise },
    data: {
      hasVariants: true,
      totalQuantity: 0,
      availableQty: 0,
      allocatedQty: 0,
      repairQty: 0,
    },
  });

  const chaiseVariants = [
    {
      reference: "MOB-CHR-NAP-001-OR",
      color: "Or",
      size: "Standard",
      unitValue: 12000,
      rentalPrice: 2500,
      totalQuantity: 80,
      availableQty: 60,
      allocatedQty: 20,
      minThreshold: 8,
    },
    {
      reference: "MOB-CHR-NAP-001-IV",
      color: "Ivoire",
      size: "Standard",
      unitValue: 11500,
      rentalPrice: 2400,
      totalQuantity: 70,
      availableQty: 55,
      allocatedQty: 15,
      minThreshold: 6,
    },
  ];

  for (let i = 0; i < chaiseVariants.length; i++) {
    const v = chaiseVariants[i];
    await prisma.itemVariant.upsert({
      where: {
        organizationId_reference: { organizationId: orgId, reference: v.reference },
      },
      update: {
        color: v.color,
        size: v.size,
        unitValue: v.unitValue,
        rentalPrice: v.rentalPrice,
        totalQuantity: v.totalQuantity,
        availableQty: v.availableQty,
        allocatedQty: v.allocatedQty,
        minThreshold: v.minThreshold,
        sortOrder: i,
        condition: "GOOD",
        status: "AVAILABLE",
      },
      create: {
        itemId: SEED_IDS.itemChaise,
        organizationId: orgId,
        reference: v.reference,
        color: v.color,
        size: v.size,
        unitValue: v.unitValue,
        rentalPrice: v.rentalPrice,
        totalQuantity: v.totalQuantity,
        availableQty: v.availableQty,
        allocatedQty: v.allocatedQty,
        repairQty: 0,
        minThreshold: v.minThreshold,
        sortOrder: i,
        condition: "GOOD",
        status: "AVAILABLE",
      },
    });
  }

  const agg = await prisma.itemVariant.aggregate({
    where: { itemId: SEED_IDS.itemChaise },
    _sum: {
      totalQuantity: true,
      availableQty: true,
      allocatedQty: true,
      repairQty: true,
    },
  });
  await prisma.item.update({
    where: { id: SEED_IDS.itemChaise },
    data: {
      totalQuantity: agg._sum.totalQuantity ?? 0,
      availableQty: agg._sum.availableQty ?? 0,
      allocatedQty: agg._sum.allocatedQty ?? 0,
      repairQty: agg._sum.repairQty ?? 0,
    },
  });

  const locStockPayload = {
    physicalQty: 37,
    systemQty: 37,
    availableQty: 30,
    reservedQty: 5,
    inTransitQty: 2,
  };
  await prisma.locationStockBalance.upsert({
    where: { id: SEED_IDS.locStockChaise },
    update: {
      organizationId: orgId,
      itemId: SEED_IDS.itemChaise,
      warehouseId: SEED_IDS.whPrincipal,
      storageZoneId: SEED_IDS.zoneShelving,
      storageLocationId: SEED_IDS.locA123,
      ...locStockPayload,
    },
    create: {
      id: SEED_IDS.locStockChaise,
      organizationId: orgId,
      itemId: SEED_IDS.itemChaise,
      warehouseId: SEED_IDS.whPrincipal,
      storageZoneId: SEED_IDS.zoneShelving,
      storageLocationId: SEED_IDS.locA123,
      ...locStockPayload,
    },
  });

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
      teamLeaderId: SEED_IDS.userManager,
      organizationId: orgId,
      lifecycle: EventLifecycle.PREPARING,
      notes: "200 convives — menu buffet",
    },
    create: {
      id: SEED_IDS.eventReception,
      name: "Réception — Famille Traoré",
      location: "Résidence Les Palmiers, Cocody",
      clientName: "Famille Traoré",
      startsAt: eventReceptionStart,
      endsAt: eventReceptionEnd,
      ownerId: SEED_IDS.userAdmin,
      teamLeaderId: SEED_IDS.userManager,
      organizationId: orgId,
      lifecycle: EventLifecycle.PREPARING,
      notes: "200 convives — menu buffet",
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
      teamLeaderId: SEED_IDS.userStorekeeper,
      organizationId: orgId,
      lifecycle: EventLifecycle.PLANNED,
      notes: "Salon plénière + 3 salles ateliers",
    },
    create: {
      id: SEED_IDS.eventSeminaire,
      name: "Séminaire Tech Corp CI",
      location: "Hôtel Ivoire, Abidjan",
      clientName: "Tech Corp CI",
      startsAt: eventSemStart,
      endsAt: eventSemEnd,
      ownerId: SEED_IDS.userManager,
      teamLeaderId: SEED_IDS.userStorekeeper,
      organizationId: orgId,
      lifecycle: EventLifecycle.PLANNED,
      notes: "Salon plénière + 3 salles ateliers",
    },
  });

  const projectAssignments = [
    {
      id: SEED_IDS.assignReception,
      eventId: SEED_IDS.eventReception,
      userId: SEED_IDS.userTechnician,
      isTeamLeader: false,
    },
    {
      id: SEED_IDS.assignSeminaire,
      eventId: SEED_IDS.eventSeminaire,
      userId: SEED_IDS.userTechnician,
      isTeamLeader: false,
    },
  ] as const;

  for (const pa of projectAssignments) {
    await prisma.projectAssignment.upsert({
      where: { eventId_userId: { eventId: pa.eventId, userId: pa.userId } },
      update: { isTeamLeader: pa.isTeamLeader },
      create: {
        id: pa.id,
        organizationId: orgId,
        eventId: pa.eventId,
        userId: pa.userId,
        isTeamLeader: pa.isTeamLeader,
      },
    });
  }

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
      where: { id: ei.id },
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
    update: {
      movementReason: MovementReason.EVENT,
    },
    create: {
      id: SEED_IDS.mov1,
      movementType: MovementType.OUTBOUND,
      movementReason: MovementReason.EVENT,
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
    update: {
      movementReason: MovementReason.CUSTOMER_RETURN,
    },
    create: {
      id: SEED_IDS.mov2,
      movementType: MovementType.RETURN,
      movementReason: MovementReason.CUSTOMER_RETURN,
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

  await prisma.stockMovement.upsert({
    where: { id: SEED_IDS.mov3 },
    update: {
      movementType: MovementType.INBOUND,
      movementReason: MovementReason.PURCHASE,
      quantity: 20,
      notes: "Réception fournisseur — lot chaises",
    },
    create: {
      id: SEED_IDS.mov3,
      movementType: MovementType.INBOUND,
      movementReason: MovementReason.PURCHASE,
      quantity: 20,
      notes: "Réception fournisseur — lot chaises",
      organizationId: orgId,
      itemId: SEED_IDS.itemChaise,
      actorId: SEED_IDS.userStorekeeper,
      createdAt: new Date(movDate.getTime() - 24 * 60 * 60 * 1000),
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: SEED_IDS.mov4 },
    update: {},
    create: {
      id: SEED_IDS.mov4,
      movementType: MovementType.TRANSFER,
      movementReason: MovementReason.INTERNAL_TRANSFER,
      quantity: 10,
      notes: "Réappro zone picking",
      organizationId: orgId,
      itemId: SEED_IDS.itemChaise,
      fromStorageLocationId: SEED_IDS.locStockChaise,
      toStorageLocationId: SEED_IDS.locA123,
      fromWarehouseId: SEED_IDS.whPrincipal,
      fromStorageZoneId: SEED_IDS.zoneShelving,
      toWarehouseId: SEED_IDS.whPrincipal,
      toStorageZoneId: SEED_IDS.zoneShelving,
      actorId: SEED_IDS.userStorekeeper,
      createdAt: new Date(movDate.getTime() - 12 * 60 * 60 * 1000),
    },
  });

  await prisma.stockMovement.upsert({
    where: { id: SEED_IDS.mov5 },
    update: {},
    create: {
      id: SEED_IDS.mov5,
      movementType: MovementType.LOSS,
      movementReason: MovementReason.DAMAGE,
      quantity: 1,
      notes: "Chaise cassée en manutention",
      organizationId: orgId,
      itemId: SEED_IDS.itemChaise,
      actorId: SEED_IDS.userStorekeeper,
      createdAt: new Date(movDate.getTime() - 6 * 60 * 60 * 1000),
    },
  });

  await prisma.event.updateMany({
    where: { id: { in: [SEED_IDS.eventReception, SEED_IDS.eventSeminaire] } },
    data: { orderStatus: OrderStatus.IN_PROGRESS },
  });

  const demoTagCode = formatTagCode("MOB-CHR-NAP", 1);
  await prisma.trackedAsset.upsert({
    where: { id: SEED_IDS.tagChaise1 },
    update: {
      tagCode: demoTagCode,
      tagCodeValidatedAt: null,
      tagCodeValidatedByUserId: null,
      itemId: SEED_IDS.itemChaise,
      rfidTagType: RfidTagType.ADHESIVE,
      status: TrackedAssetStatus.AVAILABLE,
      currentWarehouseId: SEED_IDS.whPrincipal,
    },
    create: {
      id: SEED_IDS.tagChaise1,
      organizationId: orgId,
      tagCode: demoTagCode,
      itemId: SEED_IDS.itemChaise,
      rfidTagType: RfidTagType.ADHESIVE,
      status: TrackedAssetStatus.AVAILABLE,
      currentWarehouseId: SEED_IDS.whPrincipal,
    },
  });

  await prisma.documentSequence.upsert({
    where: {
      organizationId_kind_year: {
        organizationId: orgId,
        kind: StockDocumentKind.BS,
        year: new Date().getFullYear(),
      },
    },
    update: { lastNumber: 1 },
    create: {
      id: SEED_IDS.docSeqBs,
      organizationId: orgId,
      kind: StockDocumentKind.BS,
      year: new Date().getFullYear(),
      lastNumber: 1,
    },
  });

  const demoDocNumber = `BS-${new Date().getFullYear()}-0001`;
  const tagAsset = await prisma.trackedAsset.findUnique({
    where: { organizationId_tagCode: { organizationId: orgId, tagCode: demoTagCode } },
    select: { id: true },
  });
  const trackedAssetId = tagAsset?.id ?? SEED_IDS.tagChaise1;

  await prisma.stockDocument.upsert({
    where: {
      organizationId_documentNumber: { organizationId: orgId, documentNumber: demoDocNumber },
    },
    update: {
      status: StockDocumentStatus.PENDING_SIGNATURE,
      eventId: SEED_IDS.eventReception,
      fromWarehouseId: SEED_IDS.whPrincipal,
    },
    create: {
      id: SEED_IDS.docBs1,
      organizationId: orgId,
      kind: StockDocumentKind.BS,
      bsSubtype: BsSubtype.BS_EVT,
      documentNumber: demoDocNumber,
      status: StockDocumentStatus.PENDING_SIGNATURE,
      eventId: SEED_IDS.eventReception,
      fromWarehouseId: SEED_IDS.whPrincipal,
      lines: {
        create: [
          {
            id: SEED_IDS.docLine1,
            itemId: SEED_IDS.itemChaise,
            trackedAssetId,
            expectedQty: 1,
            scannedQty: 1,
            receivedQty: 1,
          },
        ],
      },
    },
  });

  await prisma.vehicle.upsert({
    where: {
      organizationId_plateNumber: { organizationId: orgId, plateNumber: "AB-1234-CI" },
    },
    update: { label: "Camion 12T", status: VehicleStatus.AVAILABLE },
    create: {
      id: SEED_IDS.vehicle1,
      organizationId: orgId,
      label: "Camion 12T",
      plateNumber: "AB-1234-CI",
      status: VehicleStatus.AVAILABLE,
    },
  });

  await prisma.staffProfile.upsert({
    where: { userId: SEED_IDS.userStorekeeper },
    update: {},
    create: {
      organizationId: orgId,
      userId: SEED_IDS.userStorekeeper,
      category: StaffCategory.TEAM_LEADER,
      specialties: [],
    },
  });

  await prisma.staffProfile.upsert({
    where: { userId: SEED_IDS.userTechnician },
    update: {},
    create: {
      organizationId: orgId,
      userId: SEED_IDS.userTechnician,
      category: StaffCategory.RIGGER_CONFIRMED,
      specialties: [],
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
    trackedAssets: await prisma.trackedAsset.count({ where: { organizationId: orgId } }),
    stockDocuments: await prisma.stockDocument.count({ where: { organizationId: orgId } }),
    projectAssignments: await prisma.projectAssignment.count({ where: { organizationId: orgId } }),
  };

  return {
    organizationId: orgId,
    demoPassword,
    accounts: users.map((u) => ({ username: u.username, role: u.role, password: demoPassword })),
    technicianMobile: { username: "moussa", password: demoPassword },
    counts,
  };
}
