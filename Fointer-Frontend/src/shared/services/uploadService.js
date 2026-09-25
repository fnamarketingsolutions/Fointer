import api from './http/client';
import { prepareMediaForUpload } from '../utils/prepareMediaForUpload';

const MAX_BYTES = 25 * 1024 * 1024;
const CHUNK_BYTES = 6_000_000;
const VIDEO_NAME = /\.(mp4|webm|mov|m4v|mkv)$/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const uploadError = (message) => {
  const error = new Error(message);
  error.response = { data: { message } };
  return error;
};

const resourceTypeFor = (file) => {
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (VIDEO_NAME.test(file?.name || '')) return 'video';
  return 'image';
};

const buildForm = (filePart, fileName, signed) => {
  const form = new FormData();
  form.append('file', filePart, fileName);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  form.append('folder', signed.folder);
  form.append('public_id', signed.assetId);
  return form;
};

const postForm = async (url, form, headers) => {
  const response = await fetch(url, { method: 'POST', body: form, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    throw uploadError('Upload failed. Please try again.');
  }
  return body;
};

const uploadToCloudinary = async (file, signed) => {
  const cloudName = String(signed?.cloudName || '');
  if (!/^[a-zA-Z0-9_-]+$/.test(cloudName)) {
    throw uploadError('Upload failed. Please try again.');
  }

  const resourceType = signed.resourceType === 'video' ? 'video' : 'image';
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  const fileName = file.name || (resourceType === 'video' ? 'video' : 'image');

  if (file.size <= CHUNK_BYTES) {
    return postForm(url, buildForm(file, fileName, signed));
  }

  const uploadId =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  let start = 0;
  let result = null;
  while (start < file.size) {
    const end = Math.min(start + CHUNK_BYTES, file.size);
    const headers = {
      'X-Unique-Upload-Id': uploadId,
      'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
    };
    const chunk = file.slice(start, end);
    let delivered = false;
    let lastError = null;
    for (let attempt = 0; attempt < 3 && !delivered; attempt += 1) {
      try {
        result = await postForm(url, buildForm(chunk, fileName, signed), headers);
        delivered = true;
      } catch (error) {
        lastError = error;
        await sleep(400 * (attempt + 1));
      }
    }
    if (!delivered) throw lastError || uploadError('Upload failed. Please try again.');
    start = end;
  }

  return result;
};

const directUpload = async (file, folder) => {
  if (!file?.size) throw uploadError('No file uploaded.');
  if (file.size > MAX_BYTES) {
    throw uploadError('That file is too large. Use a file under 25 MB.');
  }

  const resourceType = resourceTypeFor(file);
  const signedRes = await api.post('/uploads/signature', { folder, resourceType });
  const signed = signedRes.data?.upload;
  if (!signed?.signature || !signed?.assetId || !signed?.proof) {
    throw uploadError('Could not start upload.');
  }

  await uploadToCloudinary(file, signed);

  const done = await api.post('/uploads/complete', {
    folder: signed.folder,
    assetId: signed.assetId,
    resourceType: signed.resourceType,
    timestamp: signed.timestamp,
    proof: signed.proof,
  });
  return done.data;
};

export const uploadMedia = async (file, folder = 'fointer/posts') => {
  const prepared = await prepareMediaForUpload(file);
  return directUpload(prepared, folder);
};
