---
pubDate: 2026-03-09
team: "gonzalo-melosevich"
title: "Metric: Coverage vs Utilization"
description: "Two commitment metrics that are often confused—and why both matter."
image:
  url: "/src/images/blog/9.jpg"
  alt: "Coverage"
tags:
  - metrics
---

## What It Is

Coverage and utilization are two distinct metrics for measuring commitment-based discount (Reserved Instance, Savings Plan) effectiveness. They look at the same problem from opposite directions:

- **Coverage** = percentage of eligible usage hours that were covered by a commitment (looking at usage)
- **Utilization** = percentage of purchased commitment hours that were actually consumed (looking at commitments)

In CUR, coverage is computed by comparing `reservation/ReservationARN` populated vs. empty rows for eligible instance hours. AWS Cost Explorer provides pre-built coverage and utilization reports under the "Reservations" and "Savings Plans" tabs. In FOCUS, the `CommitmentDiscountId` field identifies which commitment covered a given charge.

## Why It Matters

Coverage and utilization measure opposite failure modes of commitment management:

- **Low coverage** means you have eligible usage running at On-Demand rates when it could be covered by a commitment. You’re leaving money on the table by under-buying.
- **Low utilization** means you have commitments that aren’t being used. You paid for capacity you don’t need — waste by over-buying.

The ideal state is **high coverage + high utilization**. The failure modes:

| State | Coverage | Utilization | Problem |
|---|---|---|---|
| Under-committed | Low | High | Paying On-Demand for stable usage |
| Over-committed | High | Low | Paying for unused commitments |
| Well-optimized | High | High | Maximizing discount with minimal waste |
| Misaligned | Low | Low | Commitments don’t match actual usage patterns |

Common surprises:
- **Teams track one metric but not the other.** A cloud team proud of 95% utilization might have only 40% coverage — because they bought very few commitments, and those few are heavily used.
- **Coverage varies by service.** A company might have 80% EC2 coverage but 0% RDS coverage — the overall average hides the RDS gap.
- **Savings Plans coverage includes Lambda and Fargate**, but most RI coverage reports only show EC2. Teams miss coverage opportunities in serverless workloads.

## How to Act

1. **Set targets for both metrics.** FinOps Foundation benchmarks suggest targeting **>80% coverage** and **>90% utilization** for production workloads.
2. **Review coverage and utilization weekly** in Cost Explorer. The 7-day trailing view surfaces problems faster than monthly reporting.
3. **Decompose by service.** EC2, RDS, ElastiCache, OpenSearch, and Redshift all have separate RI programs. Check each independently.
4. **Fix low utilization before buying more coverage.** If your Savings Plan utilization is 65%, buying more commitments makes it worse. First understand why — did usage decrease? Did a workload migrate? Then rightsize your commitment.
5. **Use Convertible RIs** for lower-confidence workloads — they cost ~10% more than Standard RIs but allow instance family/region exchanges, reducing the risk of stranded commitments.
6. **Model coverage gaps in Cost Explorer’s Savings Plan recommendations** — set the lookback period to 30 days and target 85% coverage to get an AWS-generated purchase recommendation.

## Example

A company reviews their quarterly commitment report. EC2 Savings Plan utilization: 92% (great). EC2 Savings Plan coverage: 47% (poor — over half of EC2 hours are On-Demand). RDS coverage: 0% (no RDS RIs purchased at all). By buying a 1-year EC2 Compute Savings Plan sized to cover 80% of their stable EC2 baseline, and 1-year RDS Reserved Instances for their three largest databases, they raise EC2 coverage to 81% and RDS coverage to 65% — generating **$28,000/month in incremental savings** without changing a line of code.
