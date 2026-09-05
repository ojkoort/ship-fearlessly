'use strict';

const express = require('express');
const { customersById, orders, REGIONS } = require('./seed');
const { revenueReport } = require('./reports');
const { orderTotal } = require('./money');

const app = express();
app.use(express.static(require('path').join(__dirname, '..', 'public')));
const ordersById = new Map(orders.map((o) => [o.id, o]));

app.get('/health', (req, res) => {
  res.json({ ok: true, orders: orders.length, customers: customersById.size });
});

app.get('/orders/:id', (req, res) => {
  const order = ordersById.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'order not found' });
  res.json({ ...order, total: orderTotal(order) });
});

app.get('/customers/:id', (req, res) => {
  const customer = customersById.get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'customer not found' });
  res.json(customer);
});

// Independent recalculation, in integer cents. This is the only thing in the
// service that knows what the totals are supposed to be. Nothing observing the
// running system could produce it.
app.get('/reports/audit', (req, res) => {
  const region = String(req.query.region || 'us').toLowerCase();
  const days = Math.min(Number(req.query.days) || 7, 90);
  if (!REGIONS.includes(region)) {
    return res.status(400).json({ error: `unknown region: ${region}` });
  }

  const { selectOrders, summarise } = require('./reports');
  const { enrichOrders } = require('./customers');
  const selected = selectOrders(region, days);

  let cents = 0;
  for (const o of selected) {
    for (const it of o.items) {
      cents += Math.round(it.unitPrice * it.qty * (1 - o.discountPct / 100) * 100);
    }
  }

  const reported = summarise(enrichOrders(selected)).revenue;
  const expected = cents / 100;
  res.json({
    region,
    days,
    orders: selected.length,
    reported,
    expected,
    short: Math.round((expected - reported) * 100) / 100,
  });
});

app.get('/reports/revenue', (req, res) => {
  const region = String(req.query.region || 'us').toLowerCase();
  const days = Math.min(Number(req.query.days) || 7, 90);

  if (!REGIONS.includes(region)) {
    return res.status(400).json({ error: `unknown region: ${region}` });
  }

  res.json({ region, days, ...revenueReport(region, days) });
});

// Registered after all routes, per Sentry's Express setup guide. This service
// raises no exceptions, so it never fires. It is here so the install matches the
// documented one and the comparison cannot be dismissed as a partial setup.
if (process.env.SENTRY_DSN) {
  require('@sentry/node').setupExpressErrorHandler(app);
}

const port = Number(process.env.PORT) || 3000;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`orders-api listening on http://localhost:${port}`);
    // Off by default: the dashboard drives its own traffic, and one source is
    // easier to reason about than two. Set TRAFFIC=1 for load without a browser.
    if (process.env.TRAFFIC === '1') {
      startBackgroundTraffic(port);
      console.log('background traffic running');
    }
  });
}

/** Keeps the service under a realistic mix so there is always live data. */
function startBackgroundTraffic(p) {
  const base = `http://127.0.0.1:${p}`;
  setInterval(() => {
    const roll = Math.random();
    const region = roll < 0.55 ? 'us' : roll < 0.8 ? 'apac' : 'eu';
    const days = [7, 14, 30][Math.floor(Math.random() * 3)];
    fetch(`${base}/reports/revenue?region=${region}&days=${days}`)
      .then((r) => r.text())
      .catch(() => {});
  }, 700).unref();
}

module.exports = app;
