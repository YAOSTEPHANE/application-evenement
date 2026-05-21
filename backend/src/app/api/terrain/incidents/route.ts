import { ItemCondition, NotificationSeverity } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { notifyRoleGroup } from "@/lib/cdc-notification-dispatch";
import { resolveCustodianAtIncident } from "@/lib/responsibility-db";
import { resolveAssetStatusFromCondition } from "@/lib/rfid-quarantine";
import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

const incidentSchema = z.object({
  eventId: objectId.optional(),
  tagCode: z.string().min(3).max(40).optional(),
  incidentType: z.enum(["LOSS", "DAMAGE", "OTHER"]),
  description: z.string().min(5).max(2000),
});

export async function POST(request: Request) {
  try {
    const { organizationId, actorId } = await getRequestContext();
    if (!actorId) {
      return NextResponse.json({ message: "Connexion requise" }, { status: 401 });
    }
    const payload = incidentSchema.parse(await request.json());

    let eventName = "";
    if (payload.eventId) {
      const ev = await prisma.event.findFirst({
        where: { id: payload.eventId, organizationId },
        select: { name: true },
      });
      if (!ev) {
        return NextResponse.json({ message: "Événement introuvable" }, { status: 404 });
      }
      eventName = ev.name;
    }

    const reporter = await prisma.user.findFirst({
      where: { id: actorId, organizationId },
      select: { fullName: true },
    });

    const title =
      payload.incidentType === "LOSS"
        ? "Signalement perte matériel"
        : payload.incidentType === "DAMAGE"
          ? "Signalement casse matériel"
          : "Incident terrain";

    let custodianLine = "";
    if (payload.tagCode) {
      const custodian = await resolveCustodianAtIncident(
        organizationId,
        payload.tagCode,
      );
      if (custodian) {
        custodianLine = `Détenteur au signalement : ${custodian.holderName ?? "—"} (${custodian.phaseTitle}, ${custodian.holderRoleLabel})`;
      }
    }

    const body = [
      reporter?.fullName ?? "Technicien",
      eventName ? `· ${eventName}` : "",
      payload.tagCode ? `· Tag ${payload.tagCode.toUpperCase()}` : "",
      custodianLine,
      `— ${payload.description}`,
    ]
      .filter(Boolean)
      .join(" ");

    await prisma.$transaction(async (tx) => {
      if (payload.tagCode) {
        const asset = await tx.trackedAsset.findFirst({
          where: { organizationId, tagCode: payload.tagCode.toUpperCase() },
          select: { id: true, status: true },
        });
        if (asset) {
          const condition =
            payload.incidentType === "LOSS"
              ? ItemCondition.OBSOLETE
              : ItemCondition.NEEDS_REPAIR;
          await tx.trackedAsset.update({
            where: { id: asset.id },
            data: {
              condition,
              status: resolveAssetStatusFromCondition(condition, asset.status),
            },
          });
        }
      }

      await notifyRoleGroup(tx, organizationId, ["TECHNICAL_MANAGER", "ADMIN", "STOREKEEPER"], {
        module: "alertes",
        title,
        body,
        targetType: payload.eventId ? "Event" : "Incident",
        targetId: payload.eventId,
        severity: payload.incidentType === "LOSS" ? "URGENT" : "WARNING",
        channels: ["IN_APP", "EMAIL", "WHATSAPP"],
      });
    });

    return NextResponse.json({ ok: true, message: "Incident transmis" }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Impossible d'enregistrer l'incident" }, { status: 500 });
  }
}
