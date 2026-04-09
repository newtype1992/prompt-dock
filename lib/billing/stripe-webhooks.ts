import Stripe from "stripe";
import {
  mergeMetadata,
  normalizeSubscriptionStatus,
  parseSubscriptionMetadata,
  unixSecondsToIso,
  type SubscriptionPlanKey,
  type SubscriptionScope,
} from "@/lib/billing/subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeServerClient } from "@/lib/stripe/server";

type ExistingSubscriptionBinding = {
  id: string;
  plan_key: SubscriptionPlanKey;
  profile_id: string | null;
  scope: SubscriptionScope;
  stripe_customer_id: string | null;
  team_id: string | null;
};

export type StripeWebhookHandleResult = {
  handled: boolean;
  message: string;
  subscriptionId: string | null;
};

export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<StripeWebhookHandleResult> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return upsertStripeSubscription(event.data.object as Stripe.Subscription);
    default:
      return {
        handled: false,
        message: `Ignored unsupported Stripe event ${event.type}.`,
        subscriptionId: null,
      };
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<StripeWebhookHandleResult> {
  if (session.mode !== "subscription") {
    return {
      handled: false,
      message: "Ignored checkout completion without subscription mode.",
      subscriptionId: null,
    };
  }

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

  if (!subscriptionId) {
    return {
      handled: false,
      message: "Ignored checkout completion without a subscription id.",
      subscriptionId: null,
    };
  }

  const stripe = getStripeServerClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  return upsertStripeSubscription(subscription, session.metadata);
}

async function upsertStripeSubscription(
  subscription: Stripe.Subscription,
  fallbackMetadata?: Record<string, string | null | undefined> | null
): Promise<StripeWebhookHandleResult> {
  const normalizedStatus = normalizeSubscriptionStatus(subscription.status);

  if (!normalizedStatus) {
    return {
      handled: false,
      message: `Ignored subscription ${subscription.id} with unsupported status ${subscription.status}.`,
      subscriptionId: subscription.id,
    };
  }

  const admin = createAdminClient();
  const existingBinding = await findExistingSubscriptionBinding(admin, subscription.id);
  const metadata = mergeMetadata(subscription.metadata, fallbackMetadata);
  const metadataTarget = parseSubscriptionMetadata(metadata);
  const targetBinding = metadataTarget
    ? {
        planKey: metadataTarget.planKey,
        profileId: metadataTarget.profileId,
        scope: metadataTarget.scope,
        teamId: metadataTarget.teamId,
      }
    : existingBinding
      ? {
          planKey: existingBinding.plan_key,
          profileId: existingBinding.profile_id,
          scope: existingBinding.scope,
          teamId: existingBinding.team_id,
        }
      : null;

  if (!targetBinding) {
    return {
      handled: false,
      message: `Ignored subscription ${subscription.id} because no billing target metadata was available.`,
      subscriptionId: subscription.id,
    };
  }

  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? existingBinding?.stripe_customer_id ?? null;

  if (targetBinding.scope === "team" && targetBinding.teamId && stripeCustomerId) {
    await syncTeamStripeCustomerId(admin, targetBinding.teamId, stripeCustomerId);
  }

  const stripePriceId = subscription.items.data[0]?.price?.id ?? null;
  await persistSubscriptionRecord(admin, {
    current_period_end: unixSecondsToIso(getSubscriptionCurrentPeriodEnd(subscription)),
    plan_key: targetBinding.planKey,
    profile_id: targetBinding.profileId,
    scope: targetBinding.scope,
    status: normalizedStatus,
    stripe_customer_id: stripeCustomerId,
    stripe_price_id: stripePriceId,
    stripe_subscription_id: subscription.id,
    team_id: targetBinding.teamId,
  });

  return {
    handled: true,
    message: `Persisted Stripe subscription ${subscription.id} with status ${normalizedStatus}.`,
    subscriptionId: subscription.id,
  };
}

async function findExistingSubscriptionBinding(
  admin: ReturnType<typeof createAdminClient>,
  subscriptionId: string
): Promise<ExistingSubscriptionBinding | null> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("id, plan_key, profile_id, scope, stripe_customer_id, team_id")
    .eq("stripe_subscription_id", subscriptionId)
    .limit(1)
    .maybeSingle<ExistingSubscriptionBinding>();

  if (error) {
    throw new Error(`Unable to load existing subscription binding for ${subscriptionId}: ${error.message}`);
  }

  return data ?? null;
}

async function persistSubscriptionRecord(
  admin: ReturnType<typeof createAdminClient>,
  values: {
    current_period_end: string | null;
    plan_key: SubscriptionPlanKey;
    profile_id: string | null;
    scope: SubscriptionScope;
    status: string;
    stripe_customer_id: string | null;
    stripe_price_id: string | null;
    stripe_subscription_id: string;
    team_id: string | null;
  }
) {
  const existingTargetRecord = await findExistingTargetSubscription(admin, values);

  if (existingTargetRecord) {
    const { error } = await admin.from("subscriptions").update(values).eq("id", existingTargetRecord.id);

    if (error) {
      throw new Error(`Unable to update Stripe subscription ${values.stripe_subscription_id}: ${error.message}`);
    }

    return;
  }

  const { error } = await admin.from("subscriptions").insert(values);

  if (error) {
    throw new Error(`Unable to insert Stripe subscription ${values.stripe_subscription_id}: ${error.message}`);
  }
}

async function findExistingTargetSubscription(
  admin: ReturnType<typeof createAdminClient>,
  values: {
    profile_id: string | null;
    scope: SubscriptionScope;
    team_id: string | null;
  }
) {
  const query = admin
    .from("subscriptions")
    .select("id")
    .eq("scope", values.scope)
    .limit(1);

  const scopedQuery =
    values.scope === "individual"
      ? query.eq("profile_id", values.profile_id)
      : query.eq("team_id", values.team_id);

  const { data, error } = await scopedQuery.maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(`Unable to load existing billing target subscription: ${error.message}`);
  }

  return data ?? null;
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  if (subscription.items.data.length === 0) {
    return null;
  }

  return subscription.items.data.reduce((latestPeriodEnd, item) => {
    return Math.max(latestPeriodEnd, item.current_period_end);
  }, 0);
}

async function syncTeamStripeCustomerId(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
  stripeCustomerId: string
) {
  const { error } = await admin
    .from("teams")
    .update({
      stripe_customer_id: stripeCustomerId,
    })
    .eq("id", teamId);

  if (error) {
    throw new Error(`Unable to sync the Stripe customer for team ${teamId}: ${error.message}`);
  }
}
