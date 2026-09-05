export function compressImage(input, signal) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let objectUrl;
    let settled = false;
    let reader;
    let fallbackTried = false;
    const failure = (stage) => Object.assign(new Error('image_decode_failed'), { stage });
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      image.onload = image.onerror = null;
      if (reader?.readyState === 1) reader.abort();
      image.src = '';
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (error) reject(error); else resolve(result);
    };
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
    const timer = setTimeout(() => finish(failure('timeout')), 30000);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    image.onerror = () => {
      if (input instanceof Blob && !fallbackTried) {
        fallbackTried = true;
        reader = new FileReader();
        reader.onerror = () => finish(failure('read'));
        reader.onload = () => { if (!settled) image.src = reader.result; };
        try { reader.readAsDataURL(input); } catch { finish(failure('read')); }
      } else finish(failure('decode'));
    };
    const encode = (source) => {
      let canvas;
      try {
        if (!source.width || !source.height) throw failure('decode');
        const scale = Math.min(1, 1000 / Math.max(source.width, source.height));
        canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(source.width * scale));
        canvas.height = Math.max(1, Math.round(source.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('image_decode_failed');
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        const result = canvas.toDataURL('image/jpeg', 0.65);
        if (!result.startsWith('data:image/jpeg;base64,')) throw failure('encode');
        finish(null, result);
      } catch (error) { finish(failure(error.stage || 'encode')); }
      finally { if (canvas) canvas.width = canvas.height = 0; source.close?.(); }
    };
    image.onload = () => encode(image);
    try {
      if (input instanceof Blob) {
        if (!input.size || input.size > 100 * 1024 * 1024) throw failure('size');
        if (globalThis.createImageBitmap) {
          createImageBitmap(input, { resizeWidth: 1280, imageOrientation: 'from-image' }).then(bitmap => {
            if (settled) bitmap.close(); else encode(bitmap);
          }).catch(() => {
            if (settled) return;
            try { objectUrl = URL.createObjectURL(input); image.src = objectUrl; }
            catch { finish(failure('read')); }
          });
          return;
        }
        objectUrl = URL.createObjectURL(input);
      }
      image.src = objectUrl || input;
    } catch (error) { finish(failure(error.stage || 'read')); }
  });
}
