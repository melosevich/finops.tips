---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Operation: CreateSnapshot (EBS)"
description: "EBS snapshots: incremental storage that accumulates quietly until you look at the bill."
image:
  url: "/src/images/blog/1.jpg"
  alt: "Disk snapshot"
tags:
  - operations
---

## What It Is

`CreateSnapshot` is the EC2 API call that initiates a point-in-time backup of an EBS volume to S3. Snapshots are incremental — only blocks changed since the last snapshot are stored — but the billing model reflects cumulative storage across the entire snapshot chain. In CUR, snapshot costs appear under `lineItem/ProductCode` = `AmazonEC2` with `lineItem/Operation` = `CreateSnapshot` for the API call, and snapshot storage appears as `lineItem/UsageType` containing `EBS:SnapshotUsage`. In FOCUS, look for `serviceName` = `Amazon Elastic Compute Cloud` and `usageType` containing `Snapshot`.

EBS snapshots are billed at **$0.05 per GB-month** of stored data in us-east-1. The cost is based on the actual compressed data stored, not the provisioned volume size.

## Why It Matters

Snapshot costs grow silently over months and years. Common surprises:

- **No retention policy** — the default AWS behavior is to keep snapshots forever. Organizations with a few years of infrastructure history often discover hundreds of GB or several TB of orphaned snapshots from volumes that were deleted long ago.
- **Daily snapshots with no deletion** — a backup policy that creates a snapshot every day but never deletes old ones means snapshot storage grows linearly. A 500 GB volume snapshotted daily for a year accumulates roughly 500 GB in the initial full snapshot, plus incremental changes (say 5 GB/day) = **500 + (365 × 5) = ~2.3 TB** stored. At $0.05/GB: **$115/month** just for that one volume.
- **Snapshots of unused volumes** — volumes attached to terminated instances are often detached but not deleted. Automated backup tools continue creating snapshots of these zombie volumes.
- **Cross-region snapshot copies** — for DR purposes, snapshots are often copied to a second region. Each copy incurs both the data transfer cost to copy and storage cost in the destination region.
- **Fast Snapshot Restore (FSR)** — enabling FSR on a snapshot costs $0.75 per snapshot per AZ per hour, regardless of whether it's used. A dozen FSR-enabled snapshots across two AZs cost over **$1,000/month**.

## How to Act

1. **Query CUR/FOCUS** for `EBS:SnapshotUsage` costs. Group by `resourceId` to identify which snapshot families are consuming the most storage.
2. **Use Data Lifecycle Manager (DLM)** to automate snapshot creation and enforce retention. Define a policy that keeps daily snapshots for 7 days, weekly for 4 weeks, and monthly for 3 months, then deletes the rest automatically.
3. **Audit orphaned snapshots** with `aws ec2 describe-snapshots --owner-ids self` and cross-reference with existing volumes. Delete snapshots whose source volumes no longer exist and that aren't needed for AMIs.
4. **Set retention on cross-region copies** — apply DLM policies in destination regions too. DR copies don't need to live forever.
5. **Audit Fast Snapshot Restore** — run `aws ec2 describe-fast-snapshot-restores` and disable FSR for any snapshot where the per-AZ-hour cost isn't justified.
6. **Consider EBS Snapshots Archive** for infrequently accessed snapshots — archiving moves snapshot data to a lower-cost tier ($0.0125/GB-month vs $0.05), at the cost of a 24-72 hour retrieval time.

## Example

A team inherited an AWS account with 4 years of unmanaged snapshots: 2,000 snapshots totaling 8 TB of stored data. Monthly cost: **$400/month**. After auditing, 70% are from deleted volumes or redundant copies. Deleting 1,400 snapshots (6 TB) and enabling DLM for the remainder drops the bill to **$100/month** — saving **$300/month ($3,600/year)**.
