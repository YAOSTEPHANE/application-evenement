import { NextResponse } from "next/server";

/** Prisma `@db.ObjectId` : chaîne hexadécimale sur 24 caractères. */
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export function isValidMongoObjectId(id: string): boolean {
  return OBJECT_ID_RE.test(id);
}

export function jsonInvalidObjectIdResponse(): NextResponse {
  return NextResponse.json(
    {
      message:
        "Identifiant invalide : un ObjectId MongoDB (24 caractères hexadécimaux) est attendu.",
    },
    { status: 400 },
  );
}
