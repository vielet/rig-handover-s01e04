import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'x', installed: 'x', beatEverySeconds: 1, runsDir: 'runs' };

describe('GET /digest/:night', () => {
  it('renders the fixture night', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const job of ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']) {
      expect(html).toContain(job);
    }
  });

  it('404s for a missing night', async () => {
    expect((await createApp(config).request('/digest/2000-01-01')).status).toBe(404);
  });
});
