'use strict';

/**
 * Traffic generator for orders-api.
 *
 * Mix is weighted the way the service is actually used: most reports are for
 * the US and APAC regions, EU reports are a minority, and there is a steady
 * trickle of single order and customer lookups plus a few bad requests.
 *
 *   node traffic/generate.js [durationSeconds] [concurrency] [euPercent]
 *
 * euPercent controls how much of the mix asks for EU reports. Running once with
 * 0 and then again with 20 gives a clean before and after in whatever tool is
 * watching, which is how a real regression is noticed.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const DURATION = Number(process.argv[2] || 120);
const CONCURRENCY = Number(process.argv[3] || 4);
const EU_PCT = process.argv[4] === undefined ? 15 : Number(process.argv[4]);

const WEIGHTS = [
  [70 - EU_PCT, () => `/reports/revenue?region=${pick(['us', 'apac'])}&days=${pick([7, 14, 30])}`],
  [EU_PCT, () => `/reports/revenue?region=eu&days=${pick([7, 14, 30])}`],
  [20, () => `/orders/ord_${String(rint(0, 41999)).padStart(6, '0')}`],
  [8, () => `/customers/cus_${String(rint(0, 11999)).padStart(6, '0')}`],
  [2, () => pick(['/orders/ord_999999', '/reports/revenue?region=mars'])],
];

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function rint(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

function nextPath() {
  let roll = Math.random() * 100;
  for (const [weight, build] of WEIGHTS) {
    if (roll < weight) return build();
    roll -= weight;
  }
  return '/health';
}

const stats = { total: 0, byStatus: {}, slowest: 0, slowestPath: '' };

async function worker(deadline) {
  while (Date.now() < deadline) {
    const path = nextPath();
    const started = Date.now();
    try {
      const res = await fetch(BASE + path);
      await res.text();
      const ms = Date.now() - started;
      stats.total++;
      stats.byStatus[res.status] = (stats.byStatus[res.status] || 0) + 1;
      if (ms > stats.slowest) { stats.slowest = ms; stats.slowestPath = path; }
    } catch (err) {
      stats.byStatus.network = (stats.byStatus.network || 0) + 1;
    }
    await new Promise((r) => setTimeout(r, rint(20, 120)));
  }
}

(async () => {
  const deadline = Date.now() + DURATION * 1000;
  console.log(`driving ${BASE} for ${DURATION}s with ${CONCURRENCY} workers, eu=${EU_PCT}%`);
  const tick = setInterval(() => {
    process.stdout.write(`\r  ${stats.total} requests, slowest ${stats.slowest}ms  `);
  }, 1000);
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(deadline)));
  clearInterval(tick);
  console.log(`\ndone. ${stats.total} requests`);
  console.log('by status:', stats.byStatus);
  console.log(`slowest: ${stats.slowest}ms on ${stats.slowestPath}`);
})();
