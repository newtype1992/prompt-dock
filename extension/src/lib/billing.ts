import { getExtensionSupabaseClient } from "./supabase";
import { resolveSupportAppRuntimeConfig } from "./runtime-config";

const supportAppRuntimeConfig = resolveSupportAppRuntimeConfig(getRuntimeEnv());

export type BillingReturnStatus = "success" | "canceled" | "portal";

export type BillingFlowResult = {
  returned: boolean;
  status: BillingReturnStatus | null;
};

export async function startBillingFlow({
  kind,
  scope,
  teamId,
}: {
  kind: "checkout" | "portal";
  scope: "individual" | "team";
  teamId?: string | null;
}): Promise<BillingFlowResult> {
  const client = getExtensionSupabaseClient();

  if (!client) {
    throw new Error("Billing is unavailable until the support app and Supabase are configured.");
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sign in before opening billing.");
  }

  const endpoint = resolveBillingEndpoint(scope, kind);
  const requestBody = scope === "team" ? JSON.stringify({ teamId }) : undefined;
  const response = await fetch(`${supportAppRuntimeConfig.url}${endpoint}`, {
    body: requestBody,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(scope === "team"
        ? {
            "Content-Type": "application/json",
          }
        : {}),
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
        ok?: boolean;
        url?: string;
      }
    | null;

  if (!response.ok || !payload?.url) {
    throw new Error(payload?.message ?? "The billing session could not be created.");
  }

  return openBillingWindow(payload.url);
}

function resolveBillingEndpoint(scope: "individual" | "team", kind: "checkout" | "portal") {
  if (scope === "team") {
    return kind === "checkout" ? "/api/stripe/team/checkout" : "/api/stripe/team/portal";
  }

  return kind === "checkout" ? "/api/stripe/checkout" : "/api/stripe/portal";
}

function openBillingWindow(targetUrl: string): Promise<BillingFlowResult> {
  return new Promise(async (resolve) => {
    const createdTab = await chrome.tabs.create({
      active: true,
      url: targetUrl,
    });

    if (!createdTab.id) {
      resolve({
        returned: false,
        status: null,
      });
      return;
    }

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      finish({
        returned: false,
        status: null,
      });
    }, 15 * 60 * 1000);

    const finish = (result: BillingFlowResult) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      chrome.tabs.onRemoved.removeListener(handleRemoved);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      resolve(result);
    };

    const handleRemoved = (tabId: number) => {
      if (tabId === createdTab.id) {
        finish({
          returned: false,
          status: null,
        });
      }
    };

    const handleUpdated = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (tabId !== createdTab.id) {
        return;
      }

      const nextStatus = getBillingReturnStatus(changeInfo.url ?? tab.url ?? null);

      if (nextStatus) {
        finish({
          returned: true,
          status: nextStatus,
        });
      }
    };

    chrome.tabs.onRemoved.addListener(handleRemoved);
    chrome.tabs.onUpdated.addListener(handleUpdated);

    const initialStatus = getBillingReturnStatus(createdTab.url ?? null);

    if (initialStatus) {
      finish({
        returned: true,
        status: initialStatus,
      });
    }
  });
}

function getBillingReturnStatus(value: string | null): BillingReturnStatus | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const supportAppUrl = new URL(supportAppRuntimeConfig.url);

    if (url.origin !== supportAppUrl.origin || url.pathname !== "/auth" || url.searchParams.get("flow") !== "billing") {
      return null;
    }

    const status = url.searchParams.get("status");

    if (status === "success" || status === "canceled" || status === "portal") {
      return status;
    }

    return null;
  } catch {
    return null;
  }
}

function getRuntimeEnv() {
  return ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {}) as Record<
    string,
    string | undefined
  >;
}
