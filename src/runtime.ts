export type RuntimeMode = "development" | "production" | "test";

export function resolveMode(explicit?: string): RuntimeMode {
  const value = (
    explicit ||
    process.env.KINARA_ENV ||
    process.env.HARK_ENV ||
    process.env.NODE_ENV ||
    "development"
  ).toLowerCase();
  if (value === "production" || value === "prod") return "production";
  if (value === "test") return "test";
  return "development";
}

export function isProduction(mode?: RuntimeMode): boolean {
  return (mode ?? resolveMode()) === "production";
}

export function isDevelopment(mode?: RuntimeMode): boolean {
  return (mode ?? resolveMode()) === "development";
}

export function isTest(mode?: RuntimeMode): boolean {
  return (mode ?? resolveMode()) === "test";
}
