// Local copy of parseSnmpContent from packages/utils
export interface SnmpContentEntry {
  index: number;
  key: string;
  value: any;
}

export function parseSnmpContent(data: Record<string, any> | undefined): any[] {
  if (!data) return [];
  if (Array.isArray((data as any).jsonKeyValue)) return (data as any).jsonKeyValue;
  const content = (data as any).content || data;
  if (Array.isArray(content)) return content;
  return Object.entries(content).map(([key, value], idx) => ({ index: idx, key, value }));
}

