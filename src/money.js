'use strict';

/** Collapse a float to two decimal places for storage and display. */
function toMoney(value) {
  return Math.floor(value * 100) / 100;
}

function lineTotal(item, discountPct) {
  return toMoney(item.unitPrice * item.qty * (1 - discountPct / 100));
}

function orderTotal(order) {
  let sum = 0;
  for (const item of order.items) {
    sum += lineTotal(item, order.discountPct);
  }
  return toMoney(sum);
}

module.exports = { toMoney, lineTotal, orderTotal };
