/**
 * Layering (paralect):
 * - Browser code calls App Route handlers (app/.../api/.../route.ts) for REST-style JSON/stream.
 * - Handlers authenticate, then delegate to domains/.../queries/... or other server-only modules.
 * - Supabase/Postgres clients are never imported from client components.
 *
 * Domain mutations use the HTTP API only, not Server Actions, so there is a single server surface.
 */
export type HttpApiLayer = "app_route_handlers";
