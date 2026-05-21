import { describe, expect, it } from "vitest";

import { isValidMongoObjectId } from "@/lib/mongo-id";

describe("isValidMongoObjectId", () => {
  it("accepte un ObjectId hex 24 caractères", () => {
    expect(isValidMongoObjectId("507f1f77bcf86cd799439011")).toBe(true);
  });

  it("refuse les identifiants hors format ObjectId", () => {
    expect(isValidMongoObjectId("TAG-MOB-0001")).toBe(false);
    expect(isValidMongoObjectId("000090")).toBe(false);
    expect(isValidMongoObjectId("")).toBe(false);
  });

  it("accepte un hex 24 caractères même s'il s'agit d'un autre type d'entité (ex. portique seed)", () => {
    expect(isValidMongoObjectId("000000000000000000000090")).toBe(true);
  });
});
