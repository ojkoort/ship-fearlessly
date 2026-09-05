'use strict';

const { orders } = require('./seed');
const { enrichOrders } = require('./customers');
const { orderTotal } = require('./money');

function selectOrders(region, days) {
  const cutoff = Date.now() - days * 86400000;
  return orders.filter(
    (o) => o.region === region && Date.parse(o.createdAt) >= cutoff
  );
}

function summarise(enriched) {
  const byTier = Object.create(null);
  let revenue = 0;
  let unresolved = 0;

  for (const order of enriched) {
    const total = orderTotal(order);
    revenue += total;
    const tier = order.customer ? order.customer.tier : 'unknown';
    if (!order.customer) unresolved++;
    byTier[tier] = (byTier[tier] || 0) + total;
  }

  for (const tier of Object.keys(byTier)) {
    byTier[tier] = Math.round(byTier[tier] * 100) / 100;
  }

  return {
    revenue: Math.round(revenue * 100) / 100,
    orders: enriched.length,
    unresolvedCustomers: unresolved,
    byTier,
  };
}

function revenueReport(region, days) {
  const selected = selectOrders(region, days);
  const enriched = enrichOrders(selected);
  return summarise(enriched);
}

module.exports = { revenueReport, selectOrders, summarise };
