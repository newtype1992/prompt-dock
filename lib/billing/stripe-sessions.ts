import type Stripe from "stripe";
import { isActiveSubscriptionStatus, type SubscriptionStatus } from "@/lib/billing/subscriptions";
import { getStripeServerClient } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

type IndividualSubscriptionRecord = {
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

  const customerId = await getOrCreateStripeCustomer({
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

async function getOrCreateStripeCustomer({
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
      profileId,
      product: "prompt-dock",
    },
  });

  return customer.id;
}

function getStripeIndividualPriceId() {
  const priceId = process.env.STRIPE_INDIVIDUAL_PRICE_ID?.trim();

  if (!priceId) {
    throw new Error("STRIPE_INDIVIDUAL_PRICE_ID is required for individual checkout.");
  }

  return priceId;
}
