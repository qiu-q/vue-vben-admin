export async function getJson(url: string) {
  const resp = await fetch(url);
  return resp.json();
}

export async function postJson(url: string, data: any = {}) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return resp.json();
}

export async function requestJson(url: string, options: RequestInit) {
  const resp = await fetch(url, options);
  return resp.json();
}
