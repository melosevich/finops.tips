---
pubDate: 2026-03-10
team: "gonzalo-melosevich"
title: "Service: Amazon RDS"
description: "Where RDS spends money: instances, storage, I/O, and backups."
image:
  url: "/src/images/blog/5.jpg"
  alt: "Database"
tags:
  - services
---

## What It Is

Amazon RDS (Relational Database Service) is a managed database service supporting MySQL, PostgreSQL, MariaDB, Oracle, and SQL Server. RDS costs appear in CUR under `lineItem/ProductCode` = `AmazonRDS`. In FOCUS, filter `serviceName` = `Amazon Relational Database Service`. Unlike EC2, RDS billing is per-hour (not per-second), and the bill has four distinct components: **instance**, **storage**, **I/O** (for io1/io2 and magnetic), and **backup storage**.

RDS routinely accounts for 15-25% of AWS spend for data-driven applications and has some of the most opaque pricing of any AWS service.

## Why It Matters

RDS is expensive in ways that aren't immediately visible. The instance line-item is obvious, but storage growth, I/O charges, and Multi-AZ overhead can quietly double the bill.

Common surprises:
- **gp2 storage autoscaling without a ceiling** — RDS gp2 storage autoscales upward but never shrinks. A database that temporarily spikes to 5 TB stays at 5 TB billing forever unless you resize manually.
- **Multi-AZ doubling** — enabling Multi-AZ roughly doubles instance and storage costs. Many teams enable it for dev/staging environments where it provides zero real value.
- **io1/io2 storage with underutilized IOPS** — provisioned IOPS storage charges per IOPS provisioned, not per IOPS consumed. Teams that provision 10,000 IOPS to handle a peak but average 500 IOPS pay 20x what they need.
- **Snapshot accumulation** — automated backups are free within the retention window, but manual snapshots and cross-region copies persist indefinitely and bill at $0.095/GB-month.
- **Aurora Serverless v1 ACU charges during idle** — Aurora Serverless v1 scales to zero only after the idle timeout (minimum 5 minutes), charging ACU-hours even during brief pauses.

## How to Act

1. **Migrate gp2 to gp3 storage** — gp3 costs $0.115/GB-month vs $0.115/GB-month for gp2 but includes 3,000 IOPS and 125 MB/s baseline free. Any database on gp2 with provisioned IOPS can usually migrate to gp3 at lower cost. This is a zero-downtime operation for most engines.
2. **Disable Multi-AZ on non-production databases.** Schedule a monthly audit to enforce this policy.
3. **Rightsize instance classes** using Performance Insights — look at CPU, memory, and IOPS utilization over 2 weeks. An `r6g.2xlarge` is often a better fit than `r5.2xlarge` for memory-bound workloads at 10% lower cost.
4. **Set a storage autoscaling maximum** on all RDS instances. Rule of thumb: set max at 2x current size.
5. **Audit RDS snapshots** with `aws rds describe-db-snapshots --snapshot-type manual` — delete manual snapshots older than your data retention policy.

## Example

A mid-sized e-commerce platform runs 6 RDS PostgreSQL instances. Three are dev/staging with Multi-AZ enabled ($800/month extra), and their primary OLTP database uses io1 with 8,000 IOPS provisioned but averages 1,200 IOPS in CloudWatch. Disabling Multi-AZ on dev/staging and migrating the OLTP database from io1 to gp3 (with 4,000 IOPS provisioned) saves **$1,400/month** — a 28% reduction in total RDS spend.
