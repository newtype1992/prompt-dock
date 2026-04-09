import type Stripe from "stripe";
import { isActiveSubscriptionStatus, type SubscriptionStatus } from "@/lib/billing/subscriptions";
import { getStripeServerClient } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

type IndividualSubscriptionRecord = {
  status: SubscriptionStatus | null;
  stripe_customer_id: string | null;
};

type TeamBillingContext = {
  name: string;
  stripeCustomerId: string | null;
  teamId: string;
};

type TeamSubscriptionRecord = {
  status: SubscriptionStatus | null;
  stripe_customer_id: string | null;
};

export async function createIndividualCheckoutSession({
  appOrigin,
  email,
  profileId,
}: {
  appOrigin: string;
  email: string | null | undefined;
  profileId: string;
}) {
  const stripe = getStripeServerClient();
  const existingSubscription = await getLatestIndividualSubscription(profileId);

  if (existingSubscription?.status && isActiveSubscriptionStatus(existingSubscription.status)) {
    throw new Error("Your individual plan is already active.");
  }

  const customerId = await getOrCreateIndividualStripeCustomer({
    email,
    existingCustomerId: existingSubscription?.stripe_customer_id ?? null,
    profileId,
    stripe,
  });
  const priceId = getStripeIndividualPriceId();
  const successUrl = `${appOrigin}/auth?flow=billing&status=success`;
  const cancelUrl = `${appOrigin}/auth?flow=billing&status=canceled`;

  const session = await stripe.checkout.sessions.create({
    cancel_url: cancelUrl,
    client_reference_id: profileId,
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      planKey: "individual",
      profileId,
      scope: "individual",
    },
    mode: "subscription",
    subscription_data: {
      metadata: {
        planKey: "individual",
        profileId,
        scope: "individual",
      },
    },
    success_url: successUrl,
  });

  if (!session.url) {
    throw new Error("Stripe checkout did not return a redirect URL.");
  }

  return session.url;
}

export async function createIndividualBillingPortalSession({
  appOrigin,
  profileId,
}: {
  appOrigin: string;
  profileId: string;
}) {
  const stripe = getStripeServerClient();
  const existingSubscription = await getLatestIndividualSubscription(profileId);
  const customerId = existingSubscription?.stripe_customer_id;

  if (!customerId) {
    throw new Error("No Stripe billing customer was found for this account.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appOrigin}/auth?flow=billing&status=portal`,
  });

  return session.url;
}

export async function createTeamCheckoutSession({
  appOrigin,
  email,
  teamId,
  userId,
}: {
  appOrigin: string;
  email: string | null | undefined;
  teamId: string;
  userId: string;
}) {
  const stripe = getStripeServerClient();
  const team = await requireTeamOwnerBillingContext(teamId, userId);
  const existingSubscription = await getLatestTeamSubscription(team.teamId);

  if (existingSubscription?.status && isActiveSubscriptionStatus(existingSubscription.status)) {
    throw new Error("Your team plan is already active.");
  }

  const customerId = await getOrCreateTeamStripeCustomer({
    email,
    existingCustomerId: existingSubscription?.stripe_customer_id ?? team.stripeCustomerId,
    stripe,
    team,
  });
  const priceId = getStripeTeamPriceId();
  const successUrl = `${appOrigin}/auth?flow=billing&scope=team&status=success&teamId=${team.teamId}`;
  const cancelUrl = `${appOrigin}/auth?flow=billing&scope=team&status=canceled&teamId=${team.teamId}`;

  const session = await stripe.checkout.sessions.create({
    cancel_url: cancelUrl,
    client_reference_id: team.teamId,
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      planKey: "team",
      scope: "team",
      teamId: team.teamId,
    },
    mode: "subscription",
    subscription_data: {
      metadata: {
        planKey: "team",
        scope: "team",
        teamId: team.teamId,
      },
    },
    success_url: successUrl,
  });

  if (!session.url) {
    throw new Error("Stripe checkout did not return a redirect URL.");
  }

  return session.url;
}

export async function createTeamBillingPortalSession({
  appOrigin,
  teamId,
  userId,
}: {
  appOrigin: string;
  teamId: string;
  userId: string;
}) {
  const stripe = getStripeServerClient();
  const team = await requireTeamOwnerBillingContext(teamId, userId);
  const existingSubscription = await getLatestTeamSubscription(team.teamId);
  const customerId = existingSubscription?.stripe_customer_id ?? team.stripeCustomerId;

  if (!customerId) {
    throw new Error("No Stripe billing customer was found for this team.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appOrigin}/auth?flow=billing&scope=team&status=portal&teamId=${team.teamId}`,
  });

  return session.url;
}

async function getLatestIndividualSubscription(profileId: string): Promise<IndividualSubscriptionRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("status, stripe_customer_id")
    .eq("scope", "individual")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<IndividualSubscriptionRecord>();

  if (error) {
    throw new Error(`Unable to load billing status: ${error.message}`);
  }

  return data ?? null;
}

async function getLatestTeamSubscription(teamId: string): Promise<TeamSubscriptionRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("status, stripe_customer_id")
    .eq("scope", "team")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<TeamSubscriptionRecord>();

  if (error) {
    throw new Error(`Unable to load team billing status: ${error.message}`);
  }

  return data ?? null;
}

async function requireTeamOwnerBillingContext(teamId: string, userId: string): Promise<TeamBillingContext> {
  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("team_memberships")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<{ role: string }>();

  if (membershipError) {
    throw new Error(`Unable to verify team billing access: ${membershipError.message}`);
  }

  if (!membership) {
    throw new Error("Only team owners can manage team billing.");
  }

  if (membership.role !== "owner") {
    throw new Error("Only team owners can manage team billing.");
  }

  const { data: team, error: teamError } = await admin
    .from("teams")
    .select("id, name, stripe_customer_id")
    .eq("id", teamId)
    .limit(1)
    .maybeSingle<{
      id: string;
      name: string;
      stripe_customer_id: string | null;
    }>();

  if (teamError) {
    throw new Error(`Unable to load team billing target: ${teamError.message}`);
  }

  if (!team) {
    throw new Error("The requested team could not be found.");
  }

  return {
    name: team.name,
    stripeCustomerId: team.stripe_customer_id,
    teamId: team.id,
  };
}

async function getOrCreateIndividualStripeCustomer({
  email,
  existingCustomerId,
  profileId,
  stripe,
}: {
  email: string | null | undefined;
  existingCustomerId: string | null;
  profileId: string;
  stripe: Stripe;
}) {
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: {
      product: "prompt-dock",
      profileId,
    },
  });

  return customer.id;
}

async function getOrCreateTeamStripeCustomer({
  email,
  existingCustomerId,
  stripe,
  team,
}: {
  email: string | null | undefined;
  existingCustomerId: string | null;
  stripe: Stripe;
  team: TeamBillingContext;
}) {
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: {
      product: "prompt-dock",
      scope: "team",
      teamId: team.teamId,
    },
    name: team.name,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("teams")
    .update({
      stripe_customer_id: customer.id,
    })
    .eq("id", team.teamId);

  if (error) {
    throw new Error(`Unable to store the Stripe customer for ${team.name}: ${error.message}`);
  }

  return customer.id;
}

function getStripeIndividualPriceId() {
  const priceId = process.env.STRIPE_INDIVIDUAL_PRICE_ID?.trim();

  if (!priceId) {
    throw new Error("STRIPE_INDIVIDUAL_PRICE_ID is required for individual checkout.");
  }

  return priceId;
}

function getStripeTeamPriceId() {
  const priceId = process.env.STRIPE_TEAM_PRICE_ID?.trim();

  if (!priceId) {
    throw new Error("STRIPE_TEAM_PRICE_ID is required for team checkout.");
  }

  return priceId;
}
