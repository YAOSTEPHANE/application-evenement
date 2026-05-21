
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";

import { getEventOrderDetail, renderEventOrderHtml } from "@/lib/event-order-db";
import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await requireAuthenticatedContext();
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    const detail = await getEventOrderDetail(organizationId, id);
    const html = renderEventOrderHtml(detail, org?.name ?? "EVENT//RFID");

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="commande-${detail.event.name.replace(/[^\w-]+/g, "_")}.html"`,
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Export PDF indisponible" }, { status: 500 });
  }
}
