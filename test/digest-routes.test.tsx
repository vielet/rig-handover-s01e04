import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  // Written out of job order on purpose: rows must come back sorted by job.
  const full = [
    line('2026-10-28T01:00:00+01:00', 'zeta-sync', 'ok', 'ana'),
    line('2026-10-28T01:05:00+01:00', 'alpha-backup', 'retry', 'bo'),
    line('2026-10-28T01:06:00+01:00', 'alpha-backup', 'retry', 'bo'),
    line('2026-10-28T01:07:00+01:00', 'alpha-backup', 'retry', 'bo'),
    line('2026-10-28T01:08:00+01:00', 'alpha-backup', 'ok', 'bo'),
    line('2026-10-28T02:00:00+01:00', 'mid-report', 'fail', null, 'boom'),
    line('2026-10-28T03:00:00+01:00', 'calm-job', 'ok', 'cy'),
  ];
  writeFileSync(join(runsDir, '2026-10-28.jsonl'), full.join('\n') + '\n');
  writeFileSync(join(runsDir, '2026-10-29.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-10-30.jsonl'),
    [
      line('2026-10-30T01:00:00+01:00', 'beta-job', 'ok', 'ana'),
      'this is not json',
      line('2026-10-30T02:00:00+01:00', 'alpha-job', 'ok', 'bo'),
    ].join('\n') + '\n',
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

// Jobs in the order their names first appear in the page.
function jobsInPageOrder(html: string, jobs: string[]): string[] {
  return jobs
    .map((job) => ({ job, at: html.indexOf(job) }))
    .filter((j) => j.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((j) => j.job);
}

// The <tr> containing a job, so assertions stay on that row.
function rowOf(html: string, job: string): string {
  const at = html.indexOf(job);
  const start = html.lastIndexOf('<tr', at);
  const end = html.indexOf('</tr>', at);
  return html.slice(start, end);
}

describe('GET /digest/:night', () => {
  it('renders one row per job, sorted by job', async () => {
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<table');
    expect(jobsInPageOrder(html, ['zeta-sync', 'alpha-backup', 'mid-report', 'calm-job'])).toEqual([
      'alpha-backup',
      'calm-job',
      'mid-report',
      'zeta-sync',
    ]);
  });

  it('marks retries >= 3 and failing jobs with class "warn", and only those', async () => {
    const html = await (await app.request('/digest/2026-10-28')).text();
    expect(rowOf(html, 'alpha-backup')).toContain('warn');
    expect(rowOf(html, 'mid-report')).toContain('warn');
    expect(rowOf(html, 'calm-job')).not.toContain('warn');
    expect(rowOf(html, 'zeta-sync')).not.toContain('warn');
  });

  it('renders a null owner as an em dash', async () => {
    const html = await (await app.request('/digest/2026-10-28')).text();
    // Owner is the second cell; other empty cells (no error) also render as "—" (styleguide).
    expect(rowOf(html, 'mid-report')).toContain('<td>mid-report</td><td>—</td>');
    expect(rowOf(html, 'calm-job')).toContain('<td>calm-job</td><td>cy</td>');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app.request('/digest/2026-10-29');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders the other rows when a line is bad', async () => {
    const res = await app.request('/digest/2026-10-30');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(jobsInPageOrder(html, ['beta-job', 'alpha-job'])).toEqual(['alpha-job', 'beta-job']);
  });
});

describe('GET /api/digest/:night', () => {
  it('returns { night, rows, badLines } with rows sorted by job', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-backup', 'calm-job', 'mid-report', 'zeta-sync']);
    expect(body.rows[0]).toMatchObject({ job: 'alpha-backup', owner: 'bo', runs: 4, retries: 3, lastStatus: 'ok' });
    expect(body.rows[2]).toMatchObject({ job: 'mid-report', owner: null, lastStatus: 'fail', lastError: 'boom' });
  });

  it('returns 404 with { error: "no such night" } for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('returns an empty night as 200 with no rows', async () => {
    const res = await app.request('/api/digest/2026-10-29');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-29', rows: [], badLines: 0 });
  });

  it('counts a bad line and keeps the other rows', async () => {
    const res = await app.request('/api/digest/2026-10-30');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-job', 'beta-job']);
  });
});

describe('page and JSON agree', () => {
  it.each(['2026-10-28', '2026-10-30'])('list the same jobs in the same order for %s', async (night) => {
    const body = (await (await app.request(`/api/digest/${night}`)).json()) as Night;
    const jobs = body.rows.map((r) => r.job);
    const html = await (await app.request(`/digest/${night}`)).text();
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobsInPageOrder(html, [...jobs].reverse())).toEqual(jobs);
  });
});
