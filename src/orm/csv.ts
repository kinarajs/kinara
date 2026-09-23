export function csvEscape(value: unknown): string {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function csvLine(values: unknown[]): string {
  return values.map(csvEscape).join(",") + "\n";
}

export async function* documentsToCsv<T extends Record<string, unknown>>(
  documents: AsyncIterable<T>,
  columns?: string[]
): AsyncGenerator<string> {
  let headers = columns;
  let wroteHeader = false;
  for await (const document of documents) {
    headers ??= Object.keys(document);
    if (!wroteHeader && headers) {
      yield csvLine(headers);
      wroteHeader = true;
    }
    yield csvLine(headers!.map((column) => document[column]));
  }
}

export async function writeCsv<T extends Record<string, unknown>>(
  documents: AsyncIterable<T>,
  write: (chunk: string) => void | Promise<void>,
  columns?: string[]
): Promise<number> {
  let rows = 0;
  let headers = columns;
  let wroteHeader = false;
  for await (const document of documents) {
    headers ??= Object.keys(document);
    if (!wroteHeader) {
      await write(csvLine(headers));
      wroteHeader = true;
    }
    await write(csvLine(headers.map((column) => document[column])));
    rows += 1;
  }
  if (!wroteHeader && columns) {
    await write(csvLine(columns));
  }
  return rows;
}
