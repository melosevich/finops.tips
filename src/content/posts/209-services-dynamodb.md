---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Service: Amazon DynamoDB"
description: "DynamoDB's two capacity modes, hidden cost traps, and when to switch between them."
image:
  url: "/src/images/blog/1.jpg"
  alt: "NoSQL database"
tags:
  - services
---

## What It Is

Amazon DynamoDB charges on two dimensions: **capacity** (how fast you can read/write) and **storage** (how much data you keep). There are two capacity modes: **Provisioned** (you specify Read Capacity Units and Write Capacity Units per second; RCUs at $0.00013/hour and WCUs at $0.00065/hour) and **On-Demand** (pay per request; $0.25 per million WRUs and $0.025 per million RRUs in `us-east-1`). Additional charges apply for **Global Tables** replication ($0.105/million replicated WCUs), **DAX** (DynamoDB Accelerator, an in-memory cache), **streams**, and **backups**. In CUR, DynamoDB costs appear under `lineItem/ProductCode` = `AmazonDynamoDB`.

## Why It Matters

DynamoDB's two billing modes have dramatically different cost profiles depending on traffic patterns. Choosing the wrong mode — or using On-Demand as a "safe default" — can cost 5-7× more than Provisioned with Auto Scaling for steady workloads.

Common surprises:

- **On-Demand as permanent default** — On-Demand is priced for convenience and burst protection. For a table with predictable traffic, Provisioned with Auto Scaling delivers the same experience at 70-80% lower cost. Teams that never switch off On-Demand "because it was easier to set up" pay a large premium indefinitely.
- **Write costs dominate** — WCUs cost 5× more than RCUs per unit. In Provisioned mode, writes cost $0.00065/WCU-hour vs. $0.00013/RCU-hour. And On-Demand WRUs cost $0.25/million vs. RRUs at $0.025/million — a 10× gap. Access patterns that minimize unnecessary writes (e.g., conditional writes, batch writes) have disproportionate cost impact.
- **Global Tables replication multiply-charges writes** — each replicated WCU in a Global Table region adds to the bill. A table with 3 replicas costs 3× the write capacity. Teams that add Global Tables for disaster recovery without carefully considering write costs can triple their DynamoDB bill overnight.
- **Unused Reserved Capacity** — DynamoDB Reserved Capacity (a 1-year or 3-year commitment to a specific number of RCUs/WCUs) can't be transferred between tables or regions. If a team reduces a table's provisioned capacity, unused reserved capacity goes to waste.

## How to Act

1. **Audit all On-Demand tables and calculate whether Provisioned + Auto Scaling would be cheaper.** Use CloudWatch `ConsumedReadCapacityUnits` and `ConsumedWriteCapacityUnits` over 30 days. If traffic is predictable with peaks ≤ 2× the average, Provisioned will almost always be cheaper.
2. **Enable DynamoDB Auto Scaling for Provisioned tables.** Set target utilization at 70%. Auto Scaling adjusts RCUs/WCUs in response to traffic without requiring manual intervention. This eliminates most of the operational overhead that leads teams to choose On-Demand.
3. **Minimize unnecessary writes.** Use conditional expressions (`ConditionExpression`) to avoid writing unchanged data. Batch multiple writes with `BatchWriteItem`. Avoid storing ephemeral state (e.g., session counters) in DynamoDB if ElastiCache would be cheaper.
4. **Use TTL (Time-To-Live) for expiring data.** TTL deletions are free — they don't consume WCUs. For tables storing time-bounded data (sessions, events, cache records), TTL prevents unbounded storage growth with zero write cost.
5. **Carefully evaluate Global Tables need.** If your DR requirement is hours (not seconds), a Point-in-Time Recovery (PITR) backup strategy is far cheaper than Global Tables replication. Use Global Tables only where active-active multi-region is a genuine product requirement.

## Example

A startup uses DynamoDB On-Demand for their primary user table — 8 million writes/month and 80 million reads/month. Monthly bill: **$2,080** ($2,000 for writes + $80 for reads). CloudWatch shows consistent traffic at ~370 WCUs/second peak. They switch to Provisioned with Auto Scaling (target: 500 WCUs/1000 RCUs to cover peaks), purchase 1-year Reserved Capacity for 400 WCUs. New cost: **$420/month** — an 80% reduction, with identical performance and resilience.
