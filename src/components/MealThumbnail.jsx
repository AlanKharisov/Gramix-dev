import { useEffect, useRef, useState } from 'react';
import { doc, getDoc } from '../services/firestoreCompat';
import { db } from '../pages/firebase-config';

let active = 0;
const queue = [];
function drain() {
  while (active < 4 && queue.length) {
    const task = queue.shift();
    active++;
    task().finally(() => { active--; drain(); });
  }
}

export default function MealThumbnail({ mealId, fallback, ...props }) {
  const ref = useRef(null);
  const [image, setImage] = useState(null);
  useEffect(() => {
    let cancelled = false;
    let queued = false;
    let visible = false;
    const load = () => {
      if (queued) return;
      queued = true;
      queue.push(async () => {
        if (cancelled) return;
        try {
          const snap = await getDoc(doc(db, 'meal_images', mealId));
          if (!cancelled && visible) setImage(snap.exists() ? snap.data().image : null);
        } catch { /* Keep placeholder; API client reports failures. */ }
        finally { queued = false; }
      });
      drain();
    };
    if (!globalThis.IntersectionObserver) { visible = true; load(); return () => { cancelled = true; }; }
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) load(); else setImage(null);
    }, { rootMargin: '150px' });
    if (ref.current) observer.observe(ref.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [mealId]);
  return <img {...props} ref={ref} src={image || fallback} alt="" loading="lazy" decoding="async" />;
}
