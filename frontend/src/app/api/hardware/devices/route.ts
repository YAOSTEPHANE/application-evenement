import { NextResponse } from "next/server";

import { listRfidHandhelds } from "@/lib/rfid-handheld-db";
import { listRfidPortals } from "@/lib/rfid-portal-db";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    const [portals, handhelds] = await Promise.all([
      listRfidPortals(organizationId, true),
      listRfidHandhelds(organizationId, true),
    ]);

    const portiques = portals.map((p) => ({
      id: p.id,
      code: p.code,
      type: "PORTAL" as const,
      label: p.label,
      warehouseId: p.warehouseId,
      warehouseName: p.warehouse.name,
      passageDirection: p.passageDirection,
      locationHint: p.locationHint,
      scanUrl: `/api/rfid-portals/by-code/${encodeURIComponent(p.code)}/scan`,
      lastScanAt: p.lastScanAt,
    }));

    const douchettes = handhelds.map((h) => ({
      id: h.id,
      code: h.code,
      type: "HANDHELD" as const,
      label: h.label,
      warehouseId: h.warehouseId,
      warehouseName: h.warehouse?.name ?? null,
      assignedUser: h.assignedUser?.fullName ?? null,
      scanUrl: `/api/rfid-handhelds/by-code/${encodeURIComponent(h.code)}/scan`,
      lastScanAt: h.lastScanAt,
    }));

    return NextResponse.json({
      portiques,
      handhelds: douchettes,
      api: {
        portiqueScan: "/api/portique/scan",
        portiqueScanByCode: "/api/rfid-portals/by-code/{code}/scan",
        handheldScan: "/api/handheld/scan",
        handheldScanByCode: "/api/rfid-handhelds/by-code/{code}/scan",
        portalsAdmin: "/api/rfid-portals",
        handheldsAdmin: "/api/rfid-handhelds",
      },
    });
  } catch {
    return NextResponse.json({ message: "Matériel indisponible" }, { status: 500 });
  }
}
