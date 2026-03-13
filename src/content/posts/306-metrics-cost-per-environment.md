---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Metric: Cost per Environment"
description: "Breaking down cloud spend by dev, staging, and prod to find waste hiding in non-production."
image:
  url: "/src/images/blog/4.jpg"
  alt: "Environment cost breakdown"
tags:
  - metrics
---

## What It Is

Cost per Environment measures cloud spend attributed to each deployment tier — typically `development`, `staging`, and `production`. This metric requires consistent environment tagging (`environment` tag or equivalent) across all resources and accounts. The output is a monthly cost breakdown by tier, enabling comparison of non-production spend as a percentage of total.

The target metric:

```
Non-Production Ratio = (Dev + Staging Spend) / Total Cloud Spend
```

Industry benchmarks: mature engineering organizations run non-production environments at 15-25% of total cloud spend. Organizations without active non-production cost management often run at 40-60%.

In CUR, filter and group by the `environment` tag in Cost Explorer or directly in Athena queries against the CUR S3 bucket. In FOCUS, use `Tags['environment']` in your reporting.

## Why It Matters

Non-production environments are the highest-leverage area for quick savings. They run the same services as production but without revenue pressure — making them safe to rightsize, schedule, or eliminate aggressively.

Common patterns that inflate non-production costs:

- **Always-on dev environments** — engineers spin up EC2 instances or EKS clusters for development and leave them running nights and weekends. A 4 vCPU instance running 168 hours/week costs 3× what it costs if scheduled for 60 business hours/week.
- **Production-sized staging** — staging environments are often cloned from production with identical instance sizes "to ensure accuracy." In practice, staging handles a fraction of production traffic and can run on instances 50-75% smaller without affecting test validity.
- **Missing ephemeral environment cleanup** — CI/CD pipelines that spin up per-PR environments for testing may not reliably clean them up after merge or closure. Each orphaned environment continues accumulating cost until someone notices.
- **Commitment coverage applied to non-production** — Savings Plans covering non-production hours are not necessarily bad (they often cover idle production capacity), but ensure you're not buying commitments specifically sized for dev environments.

## How to Act

1. **Enforce `environment` tagging as a launch gate.** Use AWS Config rule `required-tags` or an OPA policy to block resource creation without an environment tag. Without consistent tagging, environment attribution is guesswork.
2. **Schedule non-production EC2 and RDS.** Use AWS Instance Scheduler or AWS Systems Manager Automation to stop dev/staging resources at 6PM and start them at 8AM on weekdays only. This alone often cuts non-production compute costs by 60-70%.
3. **Rightsize staging to "adequate" not "accurate".** Staging environments need to test functionality and integration, not sustain production traffic loads. Downsize staging to 50% of production instance sizes as a default policy. Escalate if load testing is required.
4. **Set automatic cleanup for ephemeral environments.** Build TTL into your IaC — every PR environment should be tagged with an expiry date and auto-terminated after 7 days (or on PR close). Treat missing cleanup as a pipeline bug.
5. **Review non-production ratio monthly.** If non-production exceeds 30% of total spend, investigate. Set a team OKR to drive non-production ratio below 20% within two quarters.

## Example

An engineering team discovers that their staging environment runs 24/7 with the same `r6g.2xlarge` RDS instance and `m5.xlarge` EC2 nodes as production. Staging costs: **$3,200/month**. They implement an Instance Scheduler (weekdays 8AM-7PM only), downsize RDS to `r6g.large`, and eliminate always-on dev instances for 3 engineers who use Cloud9. New staging cost: **$780/month**. Non-production ratio drops from 38% to 12% of total spend — **$2,420/month saved**.
