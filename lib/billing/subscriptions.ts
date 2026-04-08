import { PLAN_KEYS } from "@/lib/product/config";

export type SubscriptionPlanKey = Exclude<(typeof PLAN_KEYS)[number], "free">;

export type SubscriptionScope = SubscriptionPlanKey;

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "paused"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

export type SubscriptionMetadataTarget = {
  planKey: SubscriptionPlanKey;
  profileId: string | null;
  scope: SubscriptionScope;
  teamId: string | null;
};

const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["trialing", "active"];

export function normalizeSubscriptionStatus(value: string | null | undefined): SubscriptionStatus | null {
  if (
    value === "trialing" ||
    value === "active" ||
    value === "paused" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "incomplete" ||
    value === "incomplete_expired" ||
    value === "unpaid"
  ) {
    return value;
  }

  return null;
}

export function isActiveSubscriptionStatus(value: SubscriptionStatus | string | null | undefined) {
  const normalizedStatus = normalizeSubscriptionStatus(value);

  if (!normalizedStatus) {
    return false;
  }

  return ACTIVE_SUBSCRIPTION_STATUSES.includes(normalizedStatus);
}

export function parseSubscriptionMetadata(
  metadata: Record<string, string | null | undefined> | null | undefined
): SubscriptionMetadataTarget | null {
  if (!metadata) {
    return null;
  }

  const scope = readMetadataValue(metadata, "scope");
  const planKey = readMetadataValue(metadata, "planKey", "plan_key") ?? scope;
  const profileId = readMetadataValue(metadata, "profileId", "profile_id");
  const teamId = readMetadataValue(metadata, "teamId", "team_id");

  if (!isSubscriptionPlanKey(scope) || !isSubscriptionPlanKey(planKey) || scope !== planKey) {
    return null;
  }

  if (scope === "individual") {
    if (!profileId || teamId) {
      return null;
    }

    return {
      planKey,
      profileId,
      scope,
      teamId: null,
    };
  }

  if (!teamId || profileId) {
    return null;
  }

  return {
    planKey,
    profileId: null,
    scope,
    teamId,
  };
}

export function mergeMetadata(
  ...metadataRecords: Array<Record<string, string | null | undefined> | null | undefined>
) {
  const mergedRecord: Record<string, string> = {};

  for (const metadata of metadataRecords) {
    if (!metadata) {
      continue;
    }

    for (const [key, value] of Object.entries(metadata)) {
      const normalizedValue = value?.trim();

      if (normalizedValue) {
        mergedRecord[key] = normalizedValue;
      }
    }
  }

  return mergedRecord;
}

export function unixSecondsToIso(value: number | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

function isSubscriptionPlanKey(value: string | null | undefined): value is SubscriptionPlanKey {
  return value === "individual" || value === "team";
}

function readMetadataValue(
  metadata: Record<string, string | null | undefined>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = metadata[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}
