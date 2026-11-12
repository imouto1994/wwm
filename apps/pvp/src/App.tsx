import { HostApp } from '@/views/HostApp';
import { ViewerApp } from '@/views/ViewerApp';

/**
 * WWM Guild PvP Tournament tracker.
 *
 * Two interfaces on one SPA, chosen once from the path at load:
 * - `/host`: PIN-protected; the scorekeeper sets up the event and records results.
 * - anything else: the read-only viewer page that polls the live state.
 *
 * Both work from the same Tournament document; see docs/pvp-app.md.
 */
const IS_HOST = window.location.pathname.replace(/\/+$/, '') === '/host';

export default function App() {
  return IS_HOST ? <HostApp /> : <ViewerApp />;
}
