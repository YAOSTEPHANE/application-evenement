import { ItemCondition, TrackedAssetStatus } from "@prisma/client";

/** Quarantaine numérique CDC : endommagé ou à réparer. */
export function conditionRequiresQuarantine(condition: ItemCondition): boolean {
  return condition === ItemCondition.NEEDS_REPAIR || condition === ItemCondition.OBSOLETE;
}

export function resolveAssetStatusFromCondition(
  condition: ItemCondition,
  current: TrackedAssetStatus,
): TrackedAssetStatus {
  if (condition === ItemCondition.OBSOLETE) {
    return TrackedAssetStatus.SCRAPPED;
  }
  if (conditionRequiresQuarantine(condition)) {
    return TrackedAssetStatus.QUARANTINE;
  }
  if (current === TrackedAssetStatus.QUARANTINE || current === TrackedAssetStatus.SCRAPPED) {
    return TrackedAssetStatus.AVAILABLE;
  }
  return current;
}
