// React state cache for opened photos, separate from the bounded API cache.
export function cacheImage(previous, id, image, maxBytes = 2 * 1024 * 1024) {
  const next = {...previous};
  delete next[id];
  if (image !== null && typeof image !== 'string') return next;
  if ((image?.length || 0) * 2 > maxBytes) return next;
  next[id] = image;
  let bytes = Object.values(next).reduce((sum,value)=>sum+(value?.length || 0)*2,0);
  while (Object.keys(next).length > 8 || bytes > maxBytes) {
    const oldest = Object.keys(next)[0];
    bytes -= (next[oldest]?.length || 0)*2;
    delete next[oldest];
  }
  return next;
}
