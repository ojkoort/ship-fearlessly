'use strict';

/**
 * Deterministic dataset for the orders API.
 *
 * Seeded with a small LCG so every run of the service, the traffic generator
 * and the reconciliation script sees exactly the same data. That matters here:
 * timings and money figures from this repo are meant to be reproducible.
 */

const CUSTOMER_COUNT = 12000;
const ORDER_COUNT = 42000;

const REGIONS = ['us', 'eu', 'apac'];
const TIERS = ['free', 'pro', 'enterprise'];

const SKUS = [
  { sku: 'SEAT-STD', unitPrice: 12.5 },
  { sku: 'SEAT-PRO', unitPrice: 29.9 },
  { sku: 'STORAGE-100', unitPrice: 7.35 },
  { sku: 'STORAGE-500', unitPrice: 31.2 },
  { sku: 'SUPPORT-GOLD', unitPrice: 149.0 },
  { sku: 'API-CALLS-1M', unitPrice: 4.85 },
  { sku: 'SSO-ADDON', unitPrice: 63.75 },
  { sku: 'AUDIT-LOG', unitPrice: 18.4 },
];

let state = 1337;
function rnd() {
  state = (state * 1103515245 + 12345) & 0x7fffffff;
  return state / 0x7fffffff;
}
function pick(arr) {
  return arr[Math.floor(rnd() * arr.length)];
}
function intBetween(lo, hi) {
  return lo + Math.floor(rnd() * (hi - lo + 1));
}

function buildCustomers() {
  const customers = new Array(CUSTOMER_COUNT);
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const id = `cus_${String(i).padStart(6, '0')}`;
    const region = REGIONS[i % REGIONS.length];
    customers[i] = {
      id,
      // Mixed case on purpose: the address book is not normalised.
      email: `Account.${i}@${region}-corp.example`,
      name: `Account ${i}`,
      region,
      tier: pick(TIERS),
    };
  }
  return customers;
}

function buildOrders(customers) {
  const orders = new Array(ORDER_COUNT);
  const now = Date.UTC(2026, 8, 4);
  const day = 86400000;

  for (let i = 0; i < ORDER_COUNT; i++) {
    const customer = customers[intBetween(0, customers.length - 1)];
    const itemCount = intBetween(1, 9);
    const items = new Array(itemCount);
    for (let j = 0; j < itemCount; j++) {
      const product = pick(SKUS);
      items[j] = { sku: product.sku, qty: intBetween(1, 6), unitPrice: product.unitPrice };
    }

    // Orders imported from the legacy billing system never carried a customer id,
    // only the billing email. Roughly a third of EU orders came across that way.
    const legacyImport = customer.region === 'eu' && rnd() < 0.2;

    orders[i] = {
      id: `ord_${String(i).padStart(6, '0')}`,
      customerId: legacyImport ? null : customer.id,
      billingEmail: customer.email,
      region: customer.region,
      discountPct: rnd() < 0.35 ? pick([5, 10, 15, 20]) : 0,
      items,
      createdAt: new Date(now - intBetween(0, 89) * day).toISOString(),
    };
  }
  return orders;
}

const customers = buildCustomers();
const orders = buildOrders(customers);

const customersById = new Map(customers.map((c) => [c.id, c]));

module.exports = { customers, customersById, orders, REGIONS };
