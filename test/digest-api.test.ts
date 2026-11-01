import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('GET /api/digest/:night', () => {
  it('returns the reader output for a night, rows sorted by job', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    const body = (await res.json()) as { night: string; rows: { job: string }[]; badLines: number };
    expect(res.status).toBe(200);
    expect(body).toEqual(readNight('runs', '2026-10-28'));
    expect(body.rows).toHaveLength(5);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort((a, b) => a.localeCompare(b)));
  });

  it('404s with a JSON error for an unknown night', async () => {
    const res = await createApp(config).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });
});
