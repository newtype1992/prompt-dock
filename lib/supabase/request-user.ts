import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function requireRequestUser(request: Request): Promise<User> {
  const bearerToken = getBearerToken(request.headers.get("authorization"));

  if (bearerToken) {
    const admin = createAdminClient();
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(bearerToken);

    if (error || !user) {
      throw new Error("Unauthorized.");
    }

    return user;
  }

  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized.");
  }

  return user;
}

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, value] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !value?.trim()) {
    return null;
  }

  return value.trim();
}
