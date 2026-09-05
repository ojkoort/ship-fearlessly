'use strict';

/**
 * Sentry initialisation.
 *
 * Loaded with `node --require ./src/instrument.js src/server.js` so that it runs
 * before Express and the http module are required, which is what lets Sentry's
 * auto-instrumentation wrap them.
 *
 * Two deliberate choices, both meant to give Sentry its best shot rather than a
 * rigged one:
 *
 *   1. Stock auto-instrumentation only. No custom spans are added around
 *      application functions. The question this repo asks is what a default
 *      install tells you about a bug that lives inside application code, and
 *      hand-instrumenting the suspect function would answer it in advance.
 *
 *   2. urlQueryParams is left ON. The slow path is selected by a query
 *      parameter (?region=eu), so switching query collection off would hide the
 *      one dimension that matters and make the comparison unfair.
 *
 * userInfo and httpBodies are off because this service has neither, and leaving
 * them on would only add noise.
 */

const Sentry = require('@sentry/node');

const release = `orders-api@${process.env.DEPLOY_VERSION || '1.0.0'}`;

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'demo',
  release,
  tracesSampleRate: 1.0,
  dataCollection: {
    urlQueryParams: true,
    userInfo: false,
    httpBodies: [],
  },
  debug: process.env.SENTRY_DEBUG === '1',
});

console.log('[sentry] initialised, release', release);
