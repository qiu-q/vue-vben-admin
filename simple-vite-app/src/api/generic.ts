import { requestJson } from '#/api/http';

export function callApi(url: string, method: 'GET' | 'POST', body?: any) {
  return requestJson(url, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  });
}
