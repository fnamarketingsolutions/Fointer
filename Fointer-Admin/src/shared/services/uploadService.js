import api from './http/client';

const MAX_BYTES = 25 * 1024 * 1024;
const VIDEO_NAME = /\.(mp4|webm|mov|m4v|mkv)$/i;

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

const contentTypeFor = (file, resourceType) => {
  const mime = String(file?.type || '').trim().toLowerCase();
  if (mime) return mime;
  if (resourceType === 'video') return 'video/mp4';
  return 'image/jpeg';
};

const uploadToS3 = async (file, signed) => {
  const uploadUrl = String(signed?.uploadUrl || '');
  if (!/^https:\/\//i.test(uploadUrl)) {
    throw uploadError('Upload failed. Please try again.');
  }

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': signed.contentType || file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!response.ok) {
    throw uploadError('Upload failed. Please try again.');
  }
};

export const uploadMedia = async (file, folder = 'fointer/posts') => {
  if (!file?.size) throw uploadError('No file uploaded.');
  if (file.size > MAX_BYTES) {
    throw uploadError('That file is too large. Use a file under 25 MB.');
  }

  const resourceType = resourceTypeFor(file);
  const contentType = contentTypeFor(file, resourceType);
  const signedRes = await api.post('/uploads/signature', {
    folder,
    resourceType,
    contentType,
  });
  const signed = signedRes.data?.upload;
  if (!signed?.uploadUrl || !signed?.assetId || !signed?.proof) {
    throw uploadError('Could not start upload.');
  }

  await uploadToS3(file, signed);

  const done = await api.post('/uploads/complete', {
    folder: signed.folder,
    assetId: signed.assetId,
    resourceType: signed.resourceType,
    contentType: signed.contentType,
    timestamp: signed.timestamp,
    proof: signed.proof,
  });
  return done.data;
};
