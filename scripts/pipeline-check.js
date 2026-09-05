'use strict';

/**
 * Control experiment.
 *
 * Sends exactly one deliberate exception to Sentry, so that "the Issues stream is
 * empty" can be reported as a real observation rather than a broken pipeline.
 * Run it once, confirm the issue appears, then ignore it.
 */

const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'demo',
  release: 'orders-api@1.0.0',
});

const stamp = new Date().toISOString();
Sentry.captureException(
  new Error(`PIPELINE CHECK ${stamp} - deliberate, not part of the experiment`)
);

Sentry.flush(10000).then((ok) => {
  console.log(ok ? `sent at ${stamp}` : 'flush timed out');
  process.exit(ok ? 0 : 1);
});
