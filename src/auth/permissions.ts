import type { RequestHandler } from "express";
import { ForbiddenError, UnauthorizedError } from "../errors.js";
import { getActor, setActor } from "../context.js";

export interface Actor {
  id: string;
  roles?: string[];
  permissions?: string[];
}

export function matchesPermission(granted: string, needed: string): boolean {
  if (granted === "*" || granted === needed) return true;
  if (granted.endsWith(".*")) {
    const prefix = granted.slice(0, -1);
    return needed.startsWith(prefix);
  }
  return false;
}

export class PermissionGate {
  private readonly roles = new Map<string, string[]>();

  role(name: string, permissions: string[]): this {
    this.roles.set(name, permissions);
    return this;
  }

  permissionsFor(actor?: Actor): string[] {
    if (!actor) return [];
    const fromRoles = (actor.roles ?? []).flatMap((role) => this.roles.get(role) ?? []);
    return [...new Set([...(actor.permissions ?? []), ...fromRoles])];
  }

  can(actor: Actor | undefined, permission: string): boolean {
    return this.permissionsFor(actor).some((granted) => matchesPermission(granted, permission));
  }

  assert(actor: Actor | undefined, permission: string): void {
    if (!actor) throw new UnauthorizedError();
    if (!this.can(actor, permission)) throw new ForbiddenError(permission);
  }

  authorize(permission: string): RequestHandler {
    return (req, _res, next) => {
      const actor = (req as { actor?: Actor }).actor ?? getActor();
      try {
        this.assert(actor, permission);
        if (actor) setActor(actor);
        next();
      } catch (error) {
        next(error);
      }
    };
  }
}

export function definePermissions(roles: Record<string, string[]>): PermissionGate {
  const gate = new PermissionGate();
  for (const [name, permissions] of Object.entries(roles)) {
    gate.role(name, permissions);
  }
  return gate;
}
