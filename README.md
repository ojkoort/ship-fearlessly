# I planted two bugs in my own app. Sentry found one of them.

I had a free weekend.

Last week my brother in law mentioned offhand that he has not hand written code in six
months. Someone with a serious CV: time at Wix, a stretch as CTO of an AI startup,
today a senior engineer at a mental health company. He was not bragging. He said it the
way you would mention you stopped taking the bus.

I get it. JetBrains surveyed their users last month and found that 47% of developers'
code is now written by agents.

I am a marketer. I do not write production code. My job is taking technical products
and marketing them to the people who do, which means I read a lot about how engineers
debug things and almost never do it myself. I wanted to fix that for a weekend.

## The setup

I built a small service with Claude Code. A revenue reporting API, three regions,
42,000 orders, 12,000 customers, and a simple frontend so I could watch traffic live.

Then I planted two bugs. Neither one crashes.

Bug one: reports for one region are slow.
Bug two: every order loses a fraction of a cent, quietly.

I put Sentry on it. Free tier, default auto instrumentation, tracing on, no custom
spans. I wanted to see what a normal install actually tells you.

Both bugs pass the test suite.

## Bug one

I ran it. You can see the delay on the dashboard with your eyes.

I opened my Sentry feed. Nothing. Crickets.

So I went to Explore, then Traces. Every trace was there, and no problem showed up as an
error, because nothing threw. There was a real delay and it never became an issue.

The numbers were clear enough. Median request around 25ms. The 95th percentile at
919ms. Thirty six times the median.

Then I opened a slow trace.

```
duration    481.761932
self_time   481.762
```

Self time is the time spent in that span and not in any of its children. It is
identical to the total. Sentry was telling me, in its own measurement, that all of the
time was in one place and it could not break it down any further.

The child spans it did show were Express plumbing: `query` at 0.22ms, `expressInit` at
0.09ms, `serveStatic` at 0.26ms.

My handler calls `revenueReport`, which calls `enrichOrders`, which calls
`resolveCustomer`, which calls `matchByBillingEmail`. Four levels of my own code. None
of them are there.

To be fair to Sentry, it caught the regression in seconds and every number it showed me
was accurate. It told me the time was inside my handler. It could not tell me where
inside my handler, because it instruments frameworks and I/O clients, and my slow path
has neither.

## The part I did not plan

I planted one bug and got two problems.

Node runs on one thread and my loop is synchronous. While it runs, nothing else in the
process can. So a US request that needs four milliseconds of work arrives and waits for
the EU report ahead of it to finish.

I measured it. The same five US requests, once on an idle service and once while a
single EU report was running:

```
service idle              9    13    17    21    25 ms
during one EU report   1314  1318  1320  1324  1328 ms
```

Exactly the same work. And all five finish within 14 milliseconds of each other, which
is a queue draining, not five slow requests.

That is why the investigation was hard. If only EU had been slow it would have been over
in ten minutes. Instead Sentry showed me slow requests in every region, while the region
actually at fault was a minority of the traffic.

The bug produced the noise that hid the bug. And Sentry was not wrong about a single
number.

## Handing it to an agent

I opened a fresh Claude Code session and gave it the Sentry output.

Five minutes to find it, three more to implement a fix. What surprised me was one line
in its answer. I had pasted a span with a duration of 893ms and a self time of 0.324ms,
and it told me that span was a victim, not the cause. It worked out the queueing from a
single span and the source.

Two disclosures, because they make that look better than it was. My prompt told it EU
was slow, which is a decent share of the answer. And it found a script in a sibling copy
of the repo that demonstrates the queueing directly. Not blind, and not a clean eight
minutes.

## Bug two

The second one was built to be undetectable.

Every order rounds down instead of to nearest. About 1.3 cents per order, always in the
same direction. On one order that is nothing. On 10,000 orders a month it is $130 of
revenue you never knew you earned. Across my 42,000 orders it came to $556.37.

I added a button to the dashboard that recomputes the revenue from scratch, in integer
cents. It is the only thing in the entire system that knows the right answer, and the
way it gets there is by not trusting the system.

No error. No latency change. Eight tests passing. `18.39` and `18.40` take the same code
path in the same nanoseconds. There is no signature to detect.

That is the lesson I knew before but had never felt. To catch this you have to know what
the number was supposed to be, and that fact does not live in the running system at all.
It lives in a business rule, in an accountant's head.

## Where that leaves us

Bug one has a real answer. The gap between "the time is inside your handler" and "the
time is in `matchByBillingEmail`" is four function calls, and closing it is what runtime
tooling like Hud is built for: a sensor inside the process, collecting data per
function. How often it runs, how long it takes, what it throws, what calls what.

A human closes that gap with things they already know. This endpoint is hot. We deployed
on Tuesday. The EU data is strange because of an old migration. An agent has none of
that, so it guesses.

Bug two is a different animal, and I will be honest about it: no runtime sensor finds
it. Not Sentry, not Hud, not anything that watches code run.

The share of production code written by agents goes up every month. Most of it is fine.
Someone still has to know what the number was supposed to be.

---

## Run it yourself

```bash
git clone https://github.com/ojkoort/ship-fearlessly.git
cd ship-fearlessly
npm install
cp .env.example .env      # add a Sentry DSN, or leave it empty to run without
npm start
```

Then open http://127.0.0.1:3000 and leave it a minute. Traffic starts on its own.

**Bug one** is in [`src/customers.js`](src/customers.js). Legacy orders resolve their
customer by scanning every record instead of using the index. Only one region has legacy
orders, and the scan is synchronous, so it holds the event loop for everyone.

**Bug two** is one line in [`src/money.js`](src/money.js). Click **Independent
recalculation** on the dashboard to see what it costs.

```bash
npm test                     # 8 passing, both bugs live
node scripts/reconcile.js    # what the revenue should have been
node scripts/queueing-demo.js  # the same five requests, idle vs during one EU report
```

Eight passing tests, two live bugs. That is the whole point.
