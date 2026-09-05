'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { orderTotal, toMoney } = require('../src/money');
const { resolveCustomer } = require('../src/customers');
const { revenueReport } = require('../src/reports');
const { orders, customersById } = require('../src/seed');

test('toMoney collapses to two decimal places', () => {
  assert.strictEqual(toMoney(3.14159), 3.14);
  assert.strictEqual(toMoney(99.99), 99.99);
  assert.strictEqual(toMoney(0), 0);
});

test('orderTotal sums the line items', () => {
  const order = {
    discountPct: 0,
    items: [
      { sku: 'SEAT-STD', qty: 2, unitPrice: 12.5 },
      { sku: 'AUDIT-LOG', qty: 1, unitPrice: 18.4 },
    ],
  };
  assert.strictEqual(orderTotal(order), 43.39);
});

test('orderTotal applies a percentage discount', () => {
  const order = {
    discountPct: 10,
    items: [{ sku: 'SEAT-PRO', qty: 3, unitPrice: 29.9 }],
  };
  assert.strictEqual(orderTotal(order), 80.72);
});

test('orderTotal handles multiple discounted lines', () => {
  const order = {
    discountPct: 15,
    items: [
      { sku: 'STORAGE-100', qty: 4, unitPrice: 7.35 },
      { sku: 'API-CALLS-1M', qty: 2, unitPrice: 4.85 },
    ],
  };
  assert.strictEqual(orderTotal(order), 33.22);
});

test('orders with a customer id resolve to that customer', () => {
  const order = orders.find((o) => o.customerId);
  const customer = resolveCustomer(order);
  assert.ok(customer);
  assert.strictEqual(customer.id, order.customerId);
});

test('legacy orders without a customer id still resolve', () => {
  const order = orders.find((o) => !o.customerId);
  const customer = resolveCustomer(order);
  assert.ok(customer, 'legacy order should still find its customer');
  assert.strictEqual(customer.email.toLowerCase(), order.billingEmail.toLowerCase());
});

test('revenue report returns a summary for every region', () => {
  for (const region of ['us', 'eu', 'apac']) {
    const report = revenueReport(region, 7);
    assert.ok(report.orders > 0, `${region} should have orders`);
    assert.ok(report.revenue > 0, `${region} should have revenue`);
    assert.strictEqual(report.unresolvedCustomers, 0, `${region} should resolve every customer`);
  }
});

test('customer index is populated', () => {
  assert.ok(customersById.size > 0);
});
