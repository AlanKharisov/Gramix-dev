import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
let pendingPhoto;
let consumer;
export function installPhotoRestoration() {
  if (!Capacitor.isNativePlatform()) return;
  void App.addListener('appRestoredResult', result => {
    if (result.pluginId !== 'Camera' || !result.success) return;
    const path = result.data?.webPath || result.data?.results?.[0]?.webPath;
    if (!path) return;
    if (consumer) consumer(path); else pendingPhoto = path;
  }).catch(() => {});
}
export function subscribeRestoredPhoto(callback) {
  consumer = callback;
  if (pendingPhoto) { const path = pendingPhoto; pendingPhoto = null; callback(path); }
  return () => { if (consumer === callback) consumer = null; };
}

export async function captureNativePhoto(capture) {
  const options = { quality: 80, targetWidth: 1280, targetHeight: 1280, correctOrientation: true, saveToGallery: false };
  const result = capture ? await Camera.takePhoto(options)
    : (await Camera.chooseFromGallery({ ...options, mediaType: MediaTypeSelection.Photo, allowMultipleSelection: false, limit: 1 })).results?.[0];
  if (!result?.webPath) throw Object.assign(new Error('image_decode_failed'), { stage: 'native_picker' });
  return result.webPath;
}
