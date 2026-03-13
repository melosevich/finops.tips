---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Metric: Reserved Instance Coverage Gap"
description: "How to measure commitment coverage, find your On-Demand exposure, and decide when to buy."
image:
  url: "/src/images/blog/5.jpg"
  alt: "Commitment coverage"
tags:
  - metrics
---

## What It Is

RI Coverage Gap (also called On-Demand Exposure) measures the percentage of your eligible on-demand workload that is not covered by any commitment-based discount mechanism — Reserved Instances, Savings Plans, or Spot. It is the inverse of coverage.

The formula:

```
Coverage Gap = 1 - (Commitment-Covered Usage Hours / Total Eligible Usage Hours)
```

In AWS Cost Explorer, the **Coverage** report for Reserved Instances and Savings Plans shows this directly. In CUR, compute coverage by identifying hours where `lineItem/LineItemType` = `DiscountedUsage` (covered by RI) or `SavingsPlanCoveredUsage` (covered by Savings Plan) vs. `Usage` (On-Demand).

"Eligible" usage for coverage analysis typically excludes: Spot instances (already discounted), Fargate (covered by Compute Savings Plans but not RIs), and services without RI options (e.g., some niche services).

## Why It Matters

On-Demand pricing is the most expensive way to run stable workloads. For every $1 of On-Demand spend that could be covered by a 1-year Savings Plan, you're paying roughly $1.30 when a committed price would be ~$0.70. Coverage Gap directly quantifies this missed opportunity in dollar terms.

Coverage Gap is a leading indicator, not a lagging one — it tells you where to buy commitments next, not where you've already saved.

Common misinterpretations:

- **100% coverage is not the goal.** You need On-Demand flexibility for: unexpected scaling events, new workloads you're still sizing, and variable-use environments. Target 70-80% coverage for production workloads; leave 20-30% as On-Demand buffer.
- **Coverage ≠ Utilization.** A 90% coverage rate means 90% of your usage hours are under a commitment. But if some commitments are over-bought (utilization < 100%), your effective savings are lower than coverage implies. Track both metrics.
- **Savings Plans coverage is easier to achieve than RI coverage.** Compute Savings Plans cover EC2 regardless of instance family, size, or region — much more flexible than RIs. Calculate coverage for Savings Plans and RIs separately; don't combine them without noting the flexibility difference.
- **New workloads inflate the gap.** When a team launches a new service on On-Demand, Coverage Gap spikes. This is not necessarily a problem — it's a signal that the workload needs 30-60 days of observation before buying commitments.

## How to Act

1. **Establish a coverage target by account type.** Production: 70-80%. Staging: 10-20% (mostly scheduled/short-lived resources). Dev: 0-10%. Report Coverage Gap against these targets monthly.
2. **Run the Savings Plans Recommendations in Cost Explorer monthly.** AWS calculates the ROI-optimal commitment amount based on your trailing 60 days of usage. Use this as your primary buying signal.
3. **Apply the "30-day rule" before committing.** Never buy commitments for a workload that has been running less than 30 days. The first month shows you whether the usage is stable or variable.
4. **Buy convertible RIs for EC2 flexibility.** Standard RIs offer a deeper discount but lock you to a specific instance type. Convertible RIs allow exchanges — worth the slightly smaller discount for teams that regularly rightsize.
5. **Review Coverage Gap after every major architectural change.** When you migrate a workload, sunset a service, or launch a new product tier, recalculate coverage. Architectural changes are the most common cause of coverage drift.

## Example

A company has 1,000 eligible EC2 On-Demand hours/day. Of these, 650 hours are covered by Compute Savings Plans. Coverage = 65%, Coverage Gap = 35%. At an average On-Demand rate of $0.20/hour, the uncovered 350 hours/day = $70/day = **$2,100/month** that could be covered. Applying a 1-year Savings Plan at a 30% discount would save **$630/month**. The team reviews the 30-day usage baseline, confirms it's stable, and buys a $49/month commitment — achieving 75% coverage and closing the most expensive portion of the gap.
