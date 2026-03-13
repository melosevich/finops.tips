---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Service: Amazon ElastiCache"
description: "ElastiCache pricing mechanics, cluster sizing pitfalls, and how to cut caching costs."
image:
  url: "/src/images/blog/9.jpg"
  alt: "In-memory caching"
tags:
  - services
---

## What It Is

Amazon ElastiCache provides managed in-memory data stores — Redis (now ElastiCache for Redis, being rebranded to ElastiCache for Valkey) and Memcached. Charges are primarily **node-hours** (per instance type and engine), plus **backup storage** (for Redis snapshots beyond the free tier of 1× the cluster size), and **data transfer** between availability zones. In CUR, ElastiCache costs appear under `lineItem/ProductCode` = `AmazonElastiCache`. In FOCUS, filter `serviceName` = `Amazon ElastiCache`.

Reserved Nodes are available for ElastiCache with 1-year and 3-year terms, offering 30-45% discounts over On-Demand pricing.

## Why It Matters

ElastiCache is often provisioned during a performance crisis — "add caching, it'll be faster" — and then never revisited. The result is clusters sized for peak-of-peak load running continuously, with little visibility into actual memory utilization or cache effectiveness.

Common surprises:

- **Multi-AZ replica costs** — a Redis cluster with 2 read replicas in a different AZ costs 3× the primary node cost. That's appropriate for production, but dev/staging clusters rarely need replicas at all.
- **Under-used large nodes vs. over-used small nodes** — ElastiCache has no vertical auto-scaling; you must manually resize clusters. Teams often provision `r6g.2xlarge` nodes "to be safe" when an `r6g.large` with higher memory utilization would suffice and cost 4× less.
- **Backup storage fees** — automatic backups are free up to 1× cluster size. Retention windows of 7+ days with large clusters accumulate backup storage charges. AWS charges $0.085/GB-month for backup storage beyond the free tier.
- **Serverless ElastiCache** charges by ECPU (ElastiCache Processing Unit) and GB-hour of data stored. For variable workloads it can be cheaper, but for steady-state workloads it's often 2-3× more expensive than reserved nodes — run the math for your usage pattern.

## How to Act

1. **Eliminate replicas in non-production environments.** Single-node Redis clusters in dev/staging are sufficient for most testing scenarios. Remove read replicas from environments where replication isn't actually needed.
2. **Review memory utilization with CloudWatch `DatabaseMemoryUsagePercentage`.** If consistently below 60%, downsize the node type. If consistently above 80%, rightsize up — evictions are more expensive than the savings from a smaller node.
3. **Check cache hit rate (`CacheHits` / (`CacheHits` + `CacheMisses`)).** A hit rate below 80% often means the cache is too small relative to the working set, or TTLs are set too short. Fix this before rightsizing.
4. **Purchase Reserved Nodes for stable production clusters.** A 1-year `r6g.large` Reserved Node costs ~$730/year vs. ~$1,100/year On-Demand — a 34% saving. ElastiCache usage is almost always predictable enough to commit.
5. **Set a retention window of 1-3 days** for automated backups unless compliance requires more. Longer retention windows generate backup storage fees with marginal operational benefit in most scenarios.

## Example

A platform team runs a Redis cluster for session storage: two `r6g.xlarge` nodes ($0.248/hour each) with 7-day backup retention, plus two replicas for a total of 4 nodes. CloudWatch shows peak memory at 35% of the primary node. They downsize to `r6g.large` ($0.124/hour), drop replicas in staging (separate cluster), buy 1-year Reserved Nodes for production, and reduce backup retention to 2 days. Result: **$1,100/month → $480/month** — a 56% reduction with no application changes.
