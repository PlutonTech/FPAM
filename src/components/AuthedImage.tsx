import { useEffect, useState } from 'react';
import { authedBlobUrl } from '../api/client';

/** <img> for files behind the API's Bearer auth (a plain src can't send the token). */
export default function AuthedImage({ path, alt }: { path: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setSrc(null); setFailed(false);
    authedBlobUrl(path)
      .then(u => { if (cancelled) URL.revokeObjectURL(u); else { url = u; setSrc(u); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [path]);

  if (failed) return <i className="fa-solid fa-image" title="Could not load image" style={{ opacity: .4 }} />;
  if (!src) return <i className="fa-solid fa-spinner fa-spin" style={{ opacity: .4 }} />;
  return <img src={src} alt={alt} />;
}
