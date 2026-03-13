---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Metric: Amortized Cost vs On-Demand Cost"
description: "Why amortized cost gives a truer picture of what your cloud actually costs over time."
image:
  url: "/src/images/blog/3.jpg"
  alt: "Cost amortization"
tags:
  - metrics
---

## What It Is

**On-Demand Cost** (also called unblended cost) is what AWS actually charged in a given billing period — including lump-sum upfront payments for Reserved Instances or Savings Plans in the month they were purchased. **Amortized Cost** spreads prepayment charges across the commitment term, showing a normalized cost-per-day that reflects true ongoing resource cost.

In CUR:
- On-Demand equivalent: `lineItem/UnblendedCost`
- Amortized: `reservation/AmortizedUpfrontCostForUsage` + `reservation/RecurringFeeForUsage` for RIs, and `savingsPlan/SavingsPlanAmortizedCommitment` for Savings Plans

In FOCUS, `BilledCost` reflects actual charges (including upfront payments) while `EffectiveCost` represents the amortized view.

The formula for a single RI:

```
Monthly Amortized Cost = (Upfront Fee / Term Months) + Monthly Recurring Fee
```

## Why It Matters

Budget owners and engineers looking at monthly AWS bills can be misled by both cost views depending on context. Understanding when to use each prevents bad decisions.

Common misuses:

- **Using unblended cost for trend analysis** — if your team purchases a 3-year All-Upfront RI in June, unblended cost spikes in June and looks artificially low for the next 35 months. Trend lines based on unblended cost look like a cost reduction when it's just a prepayment moving off the books.
- **Using amortized cost for budget reconciliation** — amortized cost doesn't match your actual AWS invoice. When reconciling to what you actually owe AWS this month, use unblended (billed) cost.
- **Ignoring unused commitment waste** — amortized cost includes the amortized share of unused RIs and Savings Plans. If a commitment is underutilized, amortized cost still shows the charge even if no resource consumed it. Track `reservation/UnusedAmortizedUpfrontFeeForBillingPeriod` separately to surface this waste.
- **Mixed All-Upfront and No-Upfront commitments** — amortizing All-Upfront RIs is straightforward; No-Upfront RIs appear the same in both views because there's no prepayment to amortize.

## How to Act

1. **Use amortized cost for all FinOps trend reporting.** Decisions about rightsizing, allocation, and efficiency should be based on amortized cost so that commitment purchases don't distort the trend lines.
2. **Use billed (unblended) cost for invoice reconciliation and budget actuals.** Match what you report to Finance to what AWS invoices. Use amortized cost only for internal FinOps analysis.
3. **Build a "Commitment Amortization Schedule" view in your FinOps dashboard.** Show the monthly amortized cost of each active RI and Savings Plan commitment alongside its utilization. This surfaces both the cost and the efficiency in one view.
4. **Monitor amortized cost per service monthly.** Because amortized cost smooths out commitment purchases, it's more reliable for detecting genuine cost growth (new workloads, scaling events) than unblended cost.
5. **When comparing cloud providers, use amortized cost.** Azure and GCP use amortized models by default in their billing data. Comparing AWS unblended cost to Azure amortized cost will systematically understate AWS costs in months with large RI purchases.

## Example

A team buys a 3-year All-Upfront RI for an `r6g.4xlarge` for $25,000 upfront. In Month 1, their unblended EC2 cost spikes by $25,000 — the CFO flags an anomaly. In Month 2, EC2 spend looks artificially 97% lower than Month 1. Using amortized cost instead: $25,000 / 36 = **$694/month** for this instance for 3 years — a stable, predictable view that correctly shows the RI as cheaper than On-Demand ($1,010/month) for the committed term.
