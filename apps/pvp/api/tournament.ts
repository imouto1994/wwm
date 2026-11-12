import { handleTournamentRequest } from '../server/handler.js';
import { storeFromEnv } from '../server/store.js';

// The app's only Vercel Function. All logic lives in server/handler.ts so the
// Vite dev middleware can run exactly the same code locally.

const store = storeFromEnv(process.env);

function handle(request: Request): Promise<Response> {
  return handleTournamentRequest(request, {
    store,
    hostPin: process.env.HOST_PIN,
    readOnly: process.env.READ_ONLY === '1',
  });
}

export const GET = handle;
export const PUT = handle;
