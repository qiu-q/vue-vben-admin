export async function uploadFile(formData: FormData) {
  try {
    const resp = await fetch('/api/upload', { method: 'POST', body: formData });
    // 后端建议返回 { code, msg, data }
    const json = await resp.json().catch(() => ({}));
    if (json && typeof json === 'object' && 'code' in json) return json;
    // 兜底：非标准返回，构造成统一结构
    return { code: resp.ok ? 200 : resp.status, msg: resp.statusText, data: json?.data || json?.url || null };
  } catch (err: any) {
    return { code: -1, msg: err?.message || '上传失败', data: null };
  }
}

