import { headers } from "next/headers";

const DEFAULT_ORGANIZATION_ID = "000000000000000000000001";
const DEFAULT_ACTOR_ID = "000000000000000000000002";

export async function getRequestContext() {
  const requestHeaders = await headers();
  const organizationId =
    requestHeaders.get("x-organization-id") ?? DEFAULT_ORGANIZATION_ID;
  const actorId = requestHeaders.get("x-actor-id") ?? DEFAULT_ACTOR_ID;

  return {
    organizationId,
    actorId,
  };
}
