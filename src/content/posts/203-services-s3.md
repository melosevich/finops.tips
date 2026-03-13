---
pubDate: 2026-03-09
team: "gonzalo-melosevich"
title: "Service: Amazon S3"
description: "Storage, requests, and data transfer: how S3 costs actually show up."
image:
  url: "/src/images/blog/6.jpg"
  alt: "Buckets"
tags:
  - services
---

## What It Is

Amazon S3 (Simple Storage Service) is object storage billed across four dimensions: **storage** (GB-month), **requests** (PUT/GET/LIST/etc.), **data retrieval** (for infrequent access and Glacier tiers), and **data transfer** (outbound to internet or cross-region). In CUR, S3 costs are spread across multiple `lineItem/Operation` values — `StandardStorage`, `TimedStorage-ByteHrs`, `PutObject`, `GetObject`, `DataTransfer-Out-Bytes`, and more. In FOCUS, filter `serviceName` = `Amazon S3` and group by `operation` to decompose the bill.

S3 is often perceived as cheap but can balloon to 10-20% of total AWS spend when storage growth, request patterns, and replication are not actively managed.

## Why It Matters

S3's billing model is deceptively multi-dimensional. Organizations that track only total S3 spend miss optimization opportunities hiding in each billing dimension.

Common surprises:
- **Default storage class accumulation** — objects written to S3 Standard stay in Standard forever unless a lifecycle rule moves them. Without policies, cold data (logs, archives, old backups) accumulates at $0.023/GB-month when it could be in Glacier Instant Retrieval at $0.004/GB-month.
- **LIST operations at scale** — `ListObjects` and `ListObjectsV2` are charged at the same $0.005/1,000 rate as PUT. Crawlers, inventory jobs, or misconfigured apps that LIST constantly can generate surprise request charges.
- **Cross-region replication doubling costs** — replication adds storage charges in the destination region plus one PUT equivalent per replicated object. For large buckets, this can double storage and request costs.
- **S3 Requester Pays misconfiguration** — buckets that should bill requesters sometimes get left in standard mode, transferring all GET costs to the bucket owner.
- **Incomplete multipart uploads** — large file uploads that fail leave behind partial data that bills at Standard storage rates indefinitely.

## How to Act

1. **Implement lifecycle policies on every bucket.** A simple policy: transition to S3 Intelligent-Tiering after 30 days (auto-moves between frequent/infrequent based on access), expire non-current versions after 90 days, abort incomplete multipart uploads after 7 days.
2. **Enable S3 Storage Lens** — it provides a free organization-wide view of storage distribution by class, bucket, and region. Use it to identify buckets with no lifecycle policy.
3. **Query CUR/FOCUS** for S3 data transfer charges by `resourceId`. Buckets generating outbound data transfer to the internet at $0.09/GB are candidates for CloudFront distribution (CloudFront's origin-pull from S3 is free for same-region).
4. **Audit replication rules** — are you replicating for disaster recovery or compliance? Scope replication to only the object prefixes that require it.
5. **Run S3 Inventory** on large buckets to get a full object list with storage class, size, and last-accessed metadata. Query the inventory with Athena to find objects older than 1 year still in Standard class.

## Example

A data platform stores 500 TB of log data in S3 Standard because "someone might query it." Storage Lens reveals 420 TB hasn't been accessed in 6 months. Transitioning those 420 TB to S3 Glacier Instant Retrieval ($0.004/GB-month) cuts that storage cost from **$9,660/month to $1,680/month** — saving $7,980/month with one lifecycle rule change.
