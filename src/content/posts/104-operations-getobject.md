---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Operation: GetObject (S3)"
description: "S3 GetObject requests: what drives them, and how to stop paying for unnecessary ones."
image:
  url: "/src/images/blog/1.jpg"
  alt: "Storage bucket"
tags:
  - operations
---

## What It Is

`GetObject` is the S3 API call that retrieves an object from a bucket. It's triggered every time a file is downloaded — whether by a user, an application, a Lambda function reading a config file, or a CDN origin fetch. In CUR, these appear under `lineItem/ProductCode` = `AmazonS3` with `lineItem/Operation` = `GetObject`. In FOCUS, look for `serviceName` = `Amazon Simple Storage Service` and `operation` = `GetObject`.

AWS charges for both the request itself and the data transfer out. Requests are billed at **$0.0004 per 1,000 GET requests** in us-east-1 (varies by region). Data transfer out to the internet costs **$0.09/GB** for the first 10 TB/month. These two line items together make S3 one of the most surprising cost contributors in high-traffic workloads.

## Why It Matters

S3 request costs are invisible until they're not. Common surprises:

- **Serving static assets directly from S3** to end users, instead of through CloudFront. Every page load that pulls CSS, JS, and image assets can trigger dozens of `GetObject` calls. At 10M page views/month with 30 assets each, that's 300M GET requests = **$120/month** in request charges alone, before data transfer.
- **Repeated reads from Lambda** — functions that call `GetObject` for a config file or lookup table on every invocation instead of caching the result in the execution environment.
- **Log aggregation pipelines** that continuously fetch log files from S3 for processing, with no batching or indexing layer.
- **Versioned buckets with no lifecycle policy** — applications may be fetching old object versions unintentionally, generating redundant reads.
- **Cross-region reads** — `GetObject` calls from a compute resource in a different region than the S3 bucket incur both higher data transfer costs and latency penalties.

## How to Act

1. **Query CUR/FOCUS** for `GetObject` request counts and data transfer costs grouped by bucket. High-request buckets are your first targets.
2. **Put CloudFront in front of S3** for any publicly served content. CloudFront caches objects at edge locations, collapsing thousands of `GetObject` calls into a single origin fetch per TTL window. CloudFront origin-to-S3 transfer is free within the same region.
3. **Cache S3 reads in Lambda** — load config files or lookup data outside the Lambda handler so they persist across warm invocations. Use `s3.getObject` once on cold start, store in a module-level variable.
4. **Enable S3 Transfer Acceleration only when needed** — it adds cost, so don't use it for workloads that don't require it.
5. **Use S3 Select** for analytics pipelines that read a subset of large CSV or JSON files. S3 Select filters server-side, reducing the bytes transferred per call.
6. **Review requester-pays settings** on shared data buckets — if partners or external systems are reading your data, they should bear the request cost.

## Example

A SaaS product serves a React app with 25 static assets directly from S3. With 500K daily active users, each loading the app once, that's 12.5M `GetObject` calls/day = 375M/month. At $0.0004/1,000 requests, that's **$150/month** just in request charges, plus ~$450/month in data transfer out for 5 GB/user/month. Adding CloudFront reduces origin fetches to a few thousand per day (cache misses only), cutting the combined bill from **$600/month to under $20/month**.
