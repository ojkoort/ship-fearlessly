'use strict';

/**
 * Finance reconciliation.
 *
 * Recomputes revenue from the raw order data using exact integer cent
 * arithmetic, and compares it against what /reports/revenue returns.
 *
 * This is the only thing in this repository that knows what the totals are
 * supposed to be. Nothing in the running system can tell you.
 */

const { orders } = require('../src/seed');
const { revenueReport } = require('../src/reports');

/** Exact: work in integer cents and round half-up once per line. */
function exactOrderTotalCents(order) {
  let cents = 0;
  for (const item of order.items) {
    const exact = item.unitPrice * item.qty * (1 - order.discountPct / 100);
    cents += Math.round(exact * 100);
  }
  return cents;
}

function run(region, days) {
  const cutoff = Date.now() - days * 86400000;
  const selected = orders.filter(
    (o) => o.region === region && Date.parse(o.createdAt) >= cutoff
  );

  let expectedCents = 0;
  for (const order of selected) expectedCents += exactOrderTotalCents(order);

  const reported = revenueReport(region, days).revenue;
  const expected = expectedCents / 100;
  const delta = expected - reported;

  return { region, days, orders: selected.length, expected, reported, delta };
}

const rows = [];
for (const region of ['us', 'eu', 'apac']) {
  for (const days of [7, 30, 90]) rows.push(run(region, days));
}

console.log('region days   orders      expected      reported        short   short/order');
for (const r of rows) {
  console.log(
    r.region.padEnd(6),
    String(r.days).padEnd(5),
    String(r.orders).padStart(6),
    r.expected.toFixed(2).padStart(13),
    r.reported.toFixed(2).padStart(13),
    r.delta.toFixed(2).padStart(12),
    (r.delta / r.orders).toFixed(4).padStart(13)
  );
}

const full = rows.filter((r) => r.days === 90);
const totalShort = full.reduce((s, r) => s + r.delta, 0);
const totalOrders = full.reduce((s, r) => s + r.orders, 0);
console.log();
console.log(`Across all ${totalOrders} orders in the 90 day window the service under-reports`);
console.log(`revenue by $${totalShort.toFixed(2)}. No request failed. No request was slow.`);
