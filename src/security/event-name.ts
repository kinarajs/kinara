import { InvalidEventNameError } from "../errors.js";

const EVENT_NAME = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/;
const EVENT_PATTERN = /^(\*|[A-Za-z][A-Za-z0-9._:-]{0,126}\*?)$/;

export function assertEventName(event: string): string {
  if (typeof event !== "string" || !EVENT_NAME.test(event)) {
    throw new InvalidEventNameError(String(event));
  }
  return event;
}

export function assertEventPattern(event: string): string {
  if (typeof event !== "string" || !EVENT_PATTERN.test(event)) {
    throw new InvalidEventNameError(String(event));
  }
  return event;
}

export function matchesEvent(pattern: string, event: string): boolean {
  if (pattern === "*" || pattern === event) return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -1);
    return event.startsWith(prefix) && event.length > prefix.length;
  }
  return false;
}
