---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Service: Amazon EBS"
description: "How Elastic Block Store charges, the orphaned volume problem, and rightsizing levers."
image:
  url: "/src/images/blog/8.jpg"
  alt: "Block storage"
tags:
  - services
---

## What It Is

Amazon EBS (Elastic Block Store) provides persistent block-level storage volumes attached to EC2 instances. Charges have three components: **storage provisioned** (GB-month, regardless of how much you actually use), **IOPS provisioned** (for `io1`/`io2` volume types, per IOPS-month), and **throughput provisioned** (for `gp3`, per MB/s above baseline). In CUR, EBS costs appear under `lineItem/ProductCode` = `AmazonEC2` with `lineItem/UsageType` containing `EBS:VolumeUsage`. In FOCUS, filter `serviceName` = `Amazon Elastic Compute Cloud` and `resourceType` = `AWS::EC2::Volume`.

Snapshots are billed separately at $0.05/GB-month for incremental storage — but the first snapshot of a volume is a full copy, so initial snapshot storage can be large.

## Why It Matters

EBS is billed by provisioned capacity, not actual usage. A 1 TB `gp3` volume at 3% utilization costs the same as one at 97% utilization. This makes EBS one of the easiest services to over-provision and one of the hardest to notice overspending on.

Common surprises:

- **Orphaned volumes** — when an EC2 instance is terminated without the "delete on termination" flag (which defaults to `true` for root volumes but `false` for additional volumes), EBS volumes persist indefinitely. A 500 GB `gp3` orphan costs $40/month with zero value delivered.
- **`gp2` vs `gp3` pricing** — `gp2` charges $0.10/GB-month with IOPS tied to volume size (3 IOPS/GB). `gp3` charges $0.08/GB-month with 3,000 IOPS baseline included and independent IOPS/throughput configuration. Migrating `gp2` → `gp3` is a no-downtime operation that saves 20% on storage alone for most volumes.
- **Snapshot accumulation** — daily snapshot policies with long retention windows compound. 365 daily snapshots of a 200 GB volume don't cost 365 × 200 GB because snapshots are incremental — but they can still represent significant storage if the data changes frequently.
- **Over-provisioned `io1`/`io2` IOPS** — IOPS are charged at $0.065/IOPS-month. A volume provisioned at 10,000 IOPS for a database that peaks at 2,000 IOPS is paying 5× the necessary IOPS cost.

## How to Act

1. **Sweep for orphaned volumes monthly.** Use `aws ec2 describe-volumes --filters Name=status,Values=available` to find detached volumes. Tag them with discovery date and terminate after 30 days if unclaimed. Automate this with a Lambda rule.
2. **Migrate all `gp2` volumes to `gp3`.** The migration is non-disruptive (modifiable in-place with no downtime), saves 20% on storage per GB, and gives you independent IOPS/throughput control. There is almost no reason to stay on `gp2`.
3. **Rightsize `io1`/`io2` provisioned IOPS.** Check CloudWatch `VolumeReadOps` and `VolumeWriteOps` metrics over 30 days. If peak IOPS < 60% of provisioned, reduce provisioned IOPS to peak + 20% headroom.
4. **Enforce "delete on termination" for secondary volumes.** Use AWS Config rule `ec2-volume-inuse-check` to alert on detached volumes. For new volumes, use Launch Templates with `DeleteOnTermination: true` for all attached volumes.
5. **Audit snapshot retention policies.** Use AWS Backup or Data Lifecycle Manager (DLM) rather than ad-hoc snapshot scripts. Set retention to match your actual RTO/RPO requirements — not "keep forever to be safe."

## Example

A DevOps team discovers 47 orphaned `gp2` volumes averaging 200 GB each during a quarterly audit — **$940/month** in invisible storage spend. They terminate them after verifying no running instances reference them. Separately, they migrate 15 TB of `gp2` volumes to `gp3`, saving $300/month. And they reduce an over-provisioned `io2` RDS volume from 8,000 IOPS to 3,000 IOPS based on CloudWatch data, saving $325/month on IOPS charges. Combined: **$1,565/month saved** with zero architectural changes.
