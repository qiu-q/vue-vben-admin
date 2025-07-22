export interface SnmpContentEntry {
  key: string;
  value: any;
}

export function parseSnmpContent(data: Record<string, any> | undefined): SnmpContentEntry[] {
  if (!data) return [];
  const content = data.content || data;
  return Object.entries(content).map(([key, value]) => ({ key, value }));
}
