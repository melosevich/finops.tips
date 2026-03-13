---
pubDate: 2026-03-11
team: "gonzalo-melosevich"
title: "Metric: Effective Savings Rate (ESR)"
description: "A simple definition of ESR and how to compute it from CUR/FOCUS."
image:
  url: "/src/images/blog/7.jpg"
  alt: "Savings"
tags:
  - metrics
---

## What It Is

Effective Savings Rate (ESR) measures what percentage of your potential on-demand spend you're actually saving through commitment-based discounts (Reserved Instances, Savings Plans, Spot, private pricing agreements). It answers the question: **"If we had bought everything at list On-Demand prices, how much more would we have paid?"**

The formula:

```
ESR = 1 - (Effective Spend / On-Demand Equivalent Spend)
```

In CUR, compute On-Demand equivalent using `pricing/publicOnDemandCost` and effective spend using `lineItem/UnblendedCost` (or `reservation/EffectiveCost` + `savingsPlan/SavingsPlanEffectiveCost` for amortized views). In FOCUS, compare `BilledCost` against `ListCost` to derive the equivalent metric.

## Why It Matters

ESR is the executive-level metric for commitment efficiency. A FinOps team might be proud of their 80% Savings Plan coverage — but if they over-committed on instance types that were later rightsized, utilization suffers and ESR drops below what the coverage number implies.

Common misinterpretations:
- **High coverage ≠ high ESR** — coverage measures how much usage is protected by commitments. ESR measures whether those commitments are actually generating savings at the account level. A 90% Savings Plan coverage on oversized instances might only produce a 15% ESR.
- **ESR excludes Spot savings in basic calculations** — teams running heavy Spot workloads often underreport ESR because they don't account for Spot discounts in their baseline. Include Spot in the effective cost calculation for a complete picture.
- **ESR fluctuates with On-Demand usage** — if you add a new unoptimized service, it raises your On-Demand denominator, which can make ESR look worse even when your commitment discipline hasn't changed.
- **Blended vs. amortized ESR** — blended cost ESR smooths RI upfront charges over the term. Amortized ESR front-loads them. Choose one consistently.

## How to Act

1. **Set an ESR target by account tier.** Production accounts: target 40-60%+ ESR. Dev/staging accounts: 10-20% (they should use mostly Spot/auto-scheduled resources, not long-running On-Demand).
2. **Decompose ESR by service** — compute ESR for EC2, RDS, ElastiCache, and Lambda separately. Each has different discount mechanisms and optimization levers.
3. **Track ESR weekly** in your FinOps dashboard. A sudden ESR drop usually signals a new team spinning up unoptimized On-Demand resources.
4. **Use CUR's `pricing/publicOnDemandCost` field** as the denominator. It's AWS's precalculated equivalent On-Demand cost for each line item, including reserved and Savings Plan lines.
5. **Compare ESR across peer accounts** in your organization to identify which teams have room to improve commitment coverage.

## Example

A company has $200,000/month in effective AWS spend. If they had bought everything at On-Demand rates, it would have cost $310,000/month (derived from CUR `publicOnDemandCost`). Their ESR is:

```
ESR = 1 - (200,000 / 310,000) = 35.5%
```

The FinOps team benchmarks this against the FOCUS community average of ~40-45% for similar workload profiles, identifies that RDS has only 10% ESR (no RIs purchased), and buys 1-year RDS reserved instances to close the gap — pushing overall ESR to **42%** and saving an additional **$20,000/month**.
