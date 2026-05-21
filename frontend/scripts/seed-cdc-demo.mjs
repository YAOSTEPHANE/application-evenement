/**
 * Seed CDC uniquement (tags, bon démo, véhicule, RH) — sans réinitialiser tout le catalogue.
 * Usage : npx tsx scripts/seed-cdc-demo.mjs
 */
import { PrismaClient } from "@prisma/client";
import {
  BsSubtype,
  OrderStatus,
  RfidTagType,
  StaffCategory,
  StockDocumentKind,
  StockDocumentStatus,
  TrackedAssetStatus,
  VehicleStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const IDS = {
  org: "000000000000000000000001",
  itemChaise: "000000000000000000000020",
  eventReception: "000000000000000000000030",
  whPrincipal: "000000000000000000000070",
  userStorekeeper: "000000000000000000000004",
  tagChaise1: "0000000000000000000000a0",
  docBs1: "0000000000000000000000a1",
  docLine1: "0000000000000000000000a2",
  vehicle1: "000000000000000000000097",
  docSeqBs: "000000000000000000000094",
};

async function main() {
  const year = new Date().getFullYear();

  await prisma.trackedAsset.upsert({
    where: { id: IDS.tagChaise1 },
    update: { tagCode: "TAG-MOBC-0001", status: TrackedAssetStatus.AVAILABLE },
    create: {
      id: IDS.tagChaise1,
      organizationId: IDS.org,
      tagCode: "TAG-MOBC-0001",
      itemId: IDS.itemChaise,
      rfidTagType: RfidTagType.ADHESIVE,
      status: TrackedAssetStatus.AVAILABLE,
      currentWarehouseId: IDS.whPrincipal,
    },
  });

  await prisma.documentSequence.upsert({
    where: {
      organizationId_kind_year: {
        organizationId: IDS.org,
        kind: StockDocumentKind.BS,
        year,
      },
    },
    update: {},
    create: {
      id: IDS.docSeqBs,
      organizationId: IDS.org,
      kind: StockDocumentKind.BS,
      year,
      lastNumber: 0,
    },
  });

  const docNumber = `BS-${year}-DEMO1`;
  await prisma.stockDocument.upsert({
    where: { organizationId_documentNumber: { organizationId: IDS.org, documentNumber: docNumber } },
    update: {
      status: StockDocumentStatus.PENDING_SIGNATURE,
    },
    create: {
      id: IDS.docBs1,
      organizationId: IDS.org,
      kind: StockDocumentKind.BS,
      bsSubtype: BsSubtype.BS_EVT,
      documentNumber: docNumber,
      status: StockDocumentStatus.PENDING_SIGNATURE,
      eventId: IDS.eventReception,
      fromWarehouseId: IDS.whPrincipal,
      lines: {
        create: [
          {
            id: IDS.docLine1,
            itemId: IDS.itemChaise,
            trackedAssetId: IDS.tagChaise1,
            expectedQty: 1,
            scannedQty: 0,
            receivedQty: 0,
          },
        ],
      },
    },
  });

  await prisma.vehicle.upsert({
    where: { id: IDS.vehicle1 },
    update: {},
    create: {
      id: IDS.vehicle1,
      organizationId: IDS.org,
      label: "Camion 12T",
      plateNumber: "AB-1234-CI",
      status: VehicleStatus.AVAILABLE,
    },
  });

  await prisma.staffProfile.upsert({
    where: { userId: IDS.userStorekeeper },
    update: {},
    create: {
      organizationId: IDS.org,
      userId: IDS.userStorekeeper,
      category: StaffCategory.TEAM_LEADER,
      specialties: [],
    },
  });

  await prisma.event.updateMany({
    where: { id: IDS.eventReception },
    data: { orderStatus: OrderStatus.PENDING },
  });

  console.log("CDC demo OK — tag TAG-MOBC-0001, bon BS-EVT, véhicule, profil RH");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
