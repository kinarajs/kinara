import { ValidationError } from "../errors.js";

export interface Validatable<T = unknown> {
  validate(
    data: unknown,
    options?: { abortEarly?: boolean; stripUnknown?: boolean }
  ): Promise<T>;
}

interface FieldIssue {
  path?: string;
  message?: string;
  errors?: string[];
}

/** Runs a Yup-shaped schema and throws `ValidationError` with a field map. */
export async function validate<T>(schema: Validatable<T>, data: unknown): Promise<T> {
  try {
    return await schema.validate(data, { abortEarly: false, stripUnknown: false });
  } catch (error) {
    const fields = fieldMap(error);
    throw new ValidationError(fields ? "Validation failed" : messageOf(error), fields ?? messageOf(error));
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Validation failed";
}

function fieldMap(error: unknown): Record<string, string> | undefined {
  if (!error || typeof error !== "object") return undefined;
  const inner = (error as { inner?: FieldIssue[] }).inner;
  if (!Array.isArray(inner) || inner.length === 0) return undefined;
  const fields: Record<string, string> = {};
  for (const issue of inner) {
    if (!issue?.path) continue;
    fields[issue.path] = issue.errors?.[0] ?? issue.message ?? "Invalid";
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}
