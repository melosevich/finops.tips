---
pubDate: 2026-03-11
team: "gonzalo-melosevich"
title: "Operation: PutObject (S3)"
description: "What PutObject usually means in CUR/FOCUS and how it gets billed."
image:
  url: "/src/images/blog/1.jpg"
  alt: "S3 object storage"
tags:
  - operations
---

## What It Is

`PutObject` is the S3 API call used to upload an object to a bucket. Every time your application writes a file — a log, an image, a report, a backup — it typically fires a `PutObject` request. In AWS Cost and Usage Report (CUR), this shows up under `lineItem/Operation` as `PutObject`. In FOCUS, look for `operation` = `PutObject` with `serviceName` = `Amazon S3`.

S3 charges for PUT requests at **$0.005 per 1,000 requests** (us-east-1, standard storage class). That sounds trivial — until your app fires millions per day.

## Why It Matters

PutObject volume is one of the most overlooked S3 cost drivers. Teams frequently focus on storage GB-months and miss that request charges have quietly grown to match or exceed storage costs.

Common surprises:
- **Chatty logging pipelines** that write individual log lines as separate S3 objects instead of buffering to batches.
- **Event-driven architectures** where each Lambda invocation writes its own output file.
- **Multi-part uploads abandoned mid-way** — these don't become PutObject charges directly, but incomplete multipart uploads accumulate storage charges until a lifecycle rule cleans them up.
- **Replication** — S3 Cross-Region Replication issues one PutObject equivalent on the destination for every source write, effectively doubling your request charges.

## How to Act

1. **Query your CUR/FOCUS** for S3 `PutObject` operations grouped by `resourceId` (bucket). Sort by cost descending to find the buckets generating the most requests.
2. **Profile your write patterns** — are you writing small objects (< 1 KB) frequently? Buffering writes into larger objects (e.g., Kinesis Firehose buffering logs to 128 MB chunks) can cut request counts by 99%.
3. **Check for abandoned multipart uploads** using `aws s3api list-multipart-uploads`. Add a lifecycle rule to abort incomplete uploads after 7 days.
4. **Review replication rules** — if you're replicating to multiple destinations, request charges multiply proportionally.
5. **Use S3 Intelligent-Tiering** carefully — it does not reduce request charges, only storage costs.

## Example

A media platform streams user-uploaded thumbnails to S3 via individual `PutObject` calls from an image processing Lambda. With 50M thumbnails generated per month, that's $250/month in PUT requests alone. By batching processing jobs and writing outputs as tar archives (10 files per archive), request count drops to 5M — saving **$200/month** with zero infrastructure changes.
