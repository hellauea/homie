import axios from 'axios';
import { api } from './api';

interface SignResponse {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
}

/**
 * Uploads a local file URI (from image picker, document picker, or audio recorder)
 * to Cloudinary using signed parameters fetched from the backend.
 */
export async function uploadToCloudinary(
  fileUri: string,
  fileType: 'image' | 'video' | 'file' | 'voice'
): Promise<string> {
  // 1. Get signed credentials from server
  const folderName = fileType === 'voice' ? 'voice_notes' : 'homie_media';
  const { data: signData } = await api.post<SignResponse>('/media/sign', {
    folder: folderName,
  });

  // 2. Prepare FormData
  const formData = new FormData();
  
  // Format file object for React Native FormData
  const filename = fileUri.split('/').pop() || 'upload';
  let mimeType = 'application/octet-stream';
  
  if (fileType === 'image') {
    mimeType = 'image/jpeg';
  } else if (fileType === 'voice') {
    mimeType = 'audio/m4a'; // standard for expo-av recording
  } else if (fileType === 'video') {
    mimeType = 'video/mp4';
  } else if (filename.endsWith('.pdf')) {
    mimeType = 'application/pdf';
  } else if (filename.endsWith('.zip')) {
    mimeType = 'application/zip';
  }

  // Cast as any because React Native FormData expects an object with uri, type, and name
  formData.append('file', {
    uri: fileUri,
    type: mimeType,
    name: filename,
  } as any);

  formData.append('api_key', signData.apiKey);
  formData.append('timestamp', String(signData.timestamp));
  formData.append('signature', signData.signature);
  formData.append('folder', signData.folder);

  // 3. Upload to Cloudinary
  const uploadUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/auto/upload`;
  
  const uploadRes = await axios.post<{ secure_url: string }>(uploadUrl, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return uploadRes.data.secure_url;
}
