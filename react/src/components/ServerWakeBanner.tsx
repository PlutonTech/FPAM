import { useSyncExternalStore } from 'react';
import { slowRequests } from '../api/client';

/** Explains a slow first request instead of leaving people thinking it's broken. */
export default function ServerWakeBanner() {
  const slow = useSyncExternalStore(slowRequests.subscribe, slowRequests.get);
  if (!slow) return null;
  return (
    <div className="wake-banner" role="status">
      <i className="fa-solid fa-spinner fa-spin" /> Connecting to the server — if it has been idle it can take up to 30 seconds to wake up.
    </div>
  );
}
