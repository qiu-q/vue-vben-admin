import CryptoJS from 'crypto-js';

export interface UploadOptions {
  bucket: string;
  namespace: string;
  path: string;
  file: File;
  apiKey: string;
}

function makeSignature(bucket: string, timestamp: string, path: string, apiKey: string) {
  const innerStr = `${bucket}@@${timestamp}@@${path}`;
  const innerHash = CryptoJS.SHA256(CryptoJS.enc.Utf8.parse(innerStr)).toString(
    CryptoJS.enc.Hex,
  );
  const outerStr = innerHash + apiKey;
  return CryptoJS.SHA256(CryptoJS.enc.Utf8.parse(outerStr)).toString(CryptoJS.enc.Hex);
}

export async function uploadOssFile({ bucket, namespace, path, file, apiKey }: UploadOptions) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = makeSignature(bucket, timestamp, path, apiKey);

  const formData = new FormData();
  formData.append('namespace', namespace);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('path', path);
  formData.append('file', file);

  const uploadURL = `https://pingan1.lzjtu.edu.cn/api/oss/v1/file/upload/${bucket}`;

  const response = await fetch(uploadURL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  return response.json();
}

