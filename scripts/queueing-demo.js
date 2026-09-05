'use strict';

/**
 * Shows that the EU report does not just make EU slow, it makes everything slow.
 * Five identical US requests, run twice: once on an idle service, once while a
 * single EU report is in flight.
 */

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const US = `${BASE}/reports/revenue?region=us&days=7`;
const EU = `${BASE}/reports/revenue?region=eu&days=30`;

const B = '\x1b[1m', DIM = '\x1b[2m', G = '\x1b[32m', R = '\x1b[31m', X = '\x1b[0m';

async function timed(url) {
  const t = Date.now();
  await fetch(url).then((r) => r.text());
  return Date.now() - t;
}

const five = () => Promise.all(Array.from({ length: 5 }, () => timed(US)));
const row = (a, c) => a.map((n) => c + String(n).padStart(5) + ' ms' + X).join('   ');
const avg = (a) => Math.round(a.reduce((s, n) => s + n, 0) / a.length);

(async () => {
  await timed(US);

  const idle = await five();

  const eu = timed(EU);
  await new Promise((r) => setTimeout(r, 50));
  const during = await five();
  await eu;

  const line = '  ' + '─'.repeat(62);

  console.log('');
  console.log(`  ${B}FIVE IDENTICAL US REPORTS, RUN TWICE${X}`);
  console.log(line);
  console.log('');
  console.log(`  ${DIM}service idle${X}`);
  console.log('   ' + row(idle, G));
  console.log(`   ${DIM}average ${avg(idle)} ms${X}`);
  console.log('');
  console.log(`  ${DIM}while one EU report is running${X}`);
  console.log('   ' + row(during, R));
  console.log(`   ${DIM}average ${avg(during)} ms${X}`);
  console.log('');
  console.log(line);
  console.log(`  ${B}${Math.round(avg(during) / avg(idle))}x slower. Same work. They were queued, not slow.${X}`);
  console.log('');
})();
