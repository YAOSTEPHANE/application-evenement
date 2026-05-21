import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";

export const handheldScanBodySchema = z.object({
  tagCodes: z.array(z.string().min(3)).min(1),
  documentId: z.string().refine(isValidMongoObjectId, { message: "Bon invalide" }),
  handheldId: z
    .string()
    .refine(isValidMongoObjectId, { message: "ObjectId invalide" })
    .optional(),
  handheldCode: z.string().min(3).max(48).optional(),
});

export type HandheldScanBody = z.infer<typeof handheldScanBodySchema>;
