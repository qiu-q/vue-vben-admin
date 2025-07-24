export interface SnmpContentEntry {
  index: number;
  key: string;
  value: any;
}

/**
 * Convert SNMP style structures into simple table rows.
 */
export function parseSnmpContent(data: any): SnmpContentEntry[] {
  if (!data) return [];

  const source = data.data ?? data;

  if (Array.isArray(source)) return source;
  if (Array.isArray(source.jsonKeyValue)) return source.jsonKeyValue;

  const content =
    source.jsonValue?.content ?? source.jsonValue ?? source.content ?? source;

  if (Array.isArray(content)) return content;

  if (content && typeof content === 'object') {
    return Object.entries(content).map(([key, value], idx) => ({
      index: idx,
      key,
      value,
    }));
  }

  return [];
}
