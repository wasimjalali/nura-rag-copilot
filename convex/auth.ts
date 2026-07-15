import type { UserIdentity } from "convex/server";

export type NuraRole = "agent" | "knowledge_manager" | "operator";

export type Actor = {
  subject: string;
  role: NuraRole;
  isDevelopment: boolean;
};

type AuthContext = {
  auth: { getUserIdentity: () => Promise<UserIdentity | null> };
};

export function getActorFromIdentity(
  identity: ({ subject: string; role?: unknown } & Record<string, unknown>) | null,
  allowAnonymousDev: boolean,
): Actor {
  if (!identity) {
    if (!allowAnonymousDev) {
      throw new Error("AUTH_REQUIRED");
    }
    return {
      subject: "development-user",
      role: "operator",
      isDevelopment: true,
    };
  }

  const role = normalizeRole(identity.role);
  return { subject: identity.subject, role, isDevelopment: false };
}

export async function requireActor(ctx: AuthContext): Promise<Actor> {
  const identity = await ctx.auth.getUserIdentity();
  return getActorFromIdentity(
    identity as ({ subject: string; role?: unknown } & Record<string, unknown>) | null,
    process.env.NURA_ALLOW_ANONYMOUS_DEV === "true",
  );
}

export function requireRole(actor: Actor, allowed: NuraRole[]) {
  if (!allowed.includes(actor.role)) {
    throw new Error("FORBIDDEN");
  }
}

function normalizeRole(value: unknown): NuraRole {
  return value === "knowledge_manager" || value === "operator" ? value : "agent";
}
