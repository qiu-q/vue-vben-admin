export function formatTime(ts: string): string {
  return new Date(ts).toLocaleString();
}
