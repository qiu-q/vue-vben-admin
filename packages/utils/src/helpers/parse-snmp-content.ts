export interface SnmpContentEntry {
  index: number;
  key: string;
  value: any;
}

/**
 * Convert SNMP style objects or jsonKeyValue arrays into table friendly rows.
 */
export function parseSnmpContent(
  data: Record<string, any> | undefined,
): any[] {
  if (!data) return [];

  if (Array.isArray(data.jsonKeyValue)) {
    return data.jsonKeyValue;
  }

  const content = data.content || data;
  if (Array.isArray(content)) return content;

  return Object.entries(content).map(([key, value], idx) => ({
    index: idx,
    key,
    value,
  }));
}
