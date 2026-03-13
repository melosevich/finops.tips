---
pubDate: 2026-03-10
team: "gonzalo-melosevich"
title: "Metric: Unit Cost"
description: "Track $/GB, $/request, $/hour to connect cost with engineering outcomes."
image:
  url: "/src/images/blog/8.jpg"
  alt: "Unit economics"
tags:
  - metrics
---

## What It Is

Unit cost is the ratio of cloud spend to a business-relevant output metric — expressed as **cost per unit of value delivered**. Instead of "we spent $50K more this month," unit cost tells you "we spent $0.002 per API request, up from $0.0018 last month."

Examples of unit cost metrics:
- **$/1,000 API requests** (for API platforms)
- **$/active user/month** (for SaaS products)
- **$/GB processed** (for data pipelines)
- **$/transaction** (for payment or order systems)
- **$/model inference** (for AI/ML workloads)

In FOCUS, compute unit cost by joining `BilledCost` from your cost data with business metrics from your product analytics system. CUR alone doesn’t include business metrics — you need an external join.

## Why It Matters

Absolute spend is a lagging indicator. Unit cost is a leading indicator of architectural efficiency. A company might celebrate flat cloud spend without realizing that user count dropped 30% — meaning they’re actually paying 43% more per user.

Unit cost also decouples the FinOps conversation from the revenue conversation. Engineering teams can’t control how many users sign up, but they *can* control how efficiently their architecture serves each one.

Common pitfalls:
- **Choosing the wrong unit** — "cost per server" is an infrastructure metric, not a business metric. If engineers add servers but serve 10x more traffic per server, cost-per-server goes up while cost-per-request (the right metric) drops.
- **Ignoring seasonality** — unit cost for an e-commerce platform spikes during Cyber Monday due to provisioned capacity sitting idle on Black Friday morning. Normalize by looking at monthly averages, not daily peaks.
- **Not attributing costs to the right service** — shared infrastructure (load balancers, monitoring, network) needs to be allocated proportionally to units, not ignored. Teams that only track directly tagged costs get artificially low unit costs.
- **Tracking too many units** — start with one primary unit per product team. Too many metrics dilutes focus.

## How to Act

1. **Define your primary business unit** with each product team. The unit should be something engineers understand and can influence (requests, transactions, active users — not "revenue").
2. **Build a simple unit cost dashboard** in your BI tool: (monthly cloud spend for service X) / (monthly volume of unit Y). Trend it over 6 months.
3. **Tag your infrastructure** to services so you can compute cost-per-service accurately. Without tagging, you’re guessing at attribution.
4. **Set a unit cost budget** rather than (or in addition to) an absolute cost budget. "Don’t exceed $0.003/request" aligns engineering incentives with efficiency — a team can grow by 5x if their unit cost stays flat.
5. **Use unit cost in architecture review** — when evaluating a migration or redesign, calculate the expected unit cost change as part of the business case.

## Example

A video streaming platform tracks cost per stream-hour. In Q1, they spend $120,000/month serving 4M stream-hours = **$0.030/stream-hour**. After migrating video transcoding from EC2 to AWS MediaConvert and optimizing CDN caching, Q2 costs are $105,000/month for 5M stream-hours = **$0.021/stream-hour** — a 30% efficiency improvement, even though absolute spend only dropped 12.5%. The unit cost metric surfaces the real win.
