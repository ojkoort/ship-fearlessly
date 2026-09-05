'use strict';

const { customers, customersById } = require('./seed');

/**
 * Attach the customer record to an order.
 *
 * Orders written by the current billing service carry a customer id, so they
 * resolve straight out of the index. Orders imported from the legacy billing
 * system never got an id backfilled, so they fall back to matching on the
 * billing email instead.
 */
function resolveCustomer(order) {
  if (order.customerId) {
    return customersById.get(order.customerId) || null;
  }
  return matchByBillingEmail(order.billingEmail);
}

/**
 * Legacy addresses were entered by hand, so they are compared in a normalised
 * form: case folded, plus-addressing removed, dots in the local part ignored.
 */
function normaliseEmail(email) {
  const at = email.lastIndexOf('@');
  let local = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();
  const plus = local.indexOf('+');
  if (plus !== -1) local = local.slice(0, plus);
  return `${local.split('.').join('')}@${domain}`;
}

/**
 * Normalised billing email -> customer, built once on first use.
 *
 * Matching used to be a scan over every customer, re-normalising each address
 * on every lookup, which made a report cost orders x customers string
 * operations. Only EU orders reach this path, because only they were imported
 * without a customer id, so the cost showed up as EU-only tail latency. The
 * index makes each lookup a single hash probe. Earlier customers win a
 * collision, which is the record the old scan returned.
 */
let byNormalisedEmail = null;

function emailIndex() {
  if (byNormalisedEmail === null) {
    byNormalisedEmail = new Map();
    for (const candidate of customers) {
      const key = normaliseEmail(candidate.email);
      if (!byNormalisedEmail.has(key)) byNormalisedEmail.set(key, candidate);
    }
  }
  return byNormalisedEmail;
}

function matchByBillingEmail(email) {
  return emailIndex().get(normaliseEmail(email)) || null;
}

function enrichOrders(orders) {
  return orders.map((order) => ({
    ...order,
    customer: resolveCustomer(order),
  }));
}

module.exports = { resolveCustomer, matchByBillingEmail, normaliseEmail, enrichOrders };
