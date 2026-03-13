---
pubDate: 2026-03-11
team: "gonzalo-melosevich"
title: "Service: Amazon EC2"
description: "Compute basics, common cost drivers, and quick optimization levers."
image:
  url: "/src/images/blog/4.jpg"
  alt: "Compute instances"
tags:
  - services
---

## What It Is

Amazon EC2 (Elastic Compute Cloud) provides resizable virtual machines — instances — billed per second (minimum 60 seconds) for Linux and per hour for Windows. In CUR, EC2 instance costs appear under `lineItem/ProductCode` = `AmazonEC2` with `lineItem/Operation` = `RunInstances`. In FOCUS, filter `serviceName` = `Amazon Elastic Compute Cloud` and `resourceType` = `AWS::EC2::Instance`.

EC2 typically represents 30-50% of total AWS spend for compute-heavy workloads, making it the highest-leverage target for FinOps work.

## Why It Matters

EC2 cost is determined by three levers working together: **instance selection** (family, size, generation), **purchase option** (On-Demand, Reserved Instance, Savings Plan, Spot), and **attached resources** (EBS volumes, Elastic IPs, data transfer). Teams that optimize only one lever while ignoring the others leave significant savings on the table.

Common surprises:
- **Oversized instances from lift-and-shift migrations** — on-premises servers are routinely over-provisioned. Moving them to EC2 without rightsizing carries that waste to the cloud at hourly rates.
- **Stopped instances still billing for EBS** — an EC2 instance stopped for 6 months accrues zero compute charges but continues paying for attached EBS volumes ($0.08/GB-month for gp3).
- **Previous-generation instances** — a `m4.xlarge` costs ~15% more than an equivalent `m7i.xlarge` with better performance. Teams that never revisit instance types drift toward higher costs over time.
- **Elastic IPs on stopped instances** — AWS charges $0.005/hour (~$3.65/month) per unattached or stopped-instance Elastic IP.

## How to Act

1. **Rightsize first, commit second.** Use AWS Compute Optimizer or Cost Explorer's rightsizing recommendations to identify instances running at < 20% average CPU. Downsize before buying commitments — you don't want to lock in waste.
2. **Compute Savings Plans** cover EC2, Lambda, and Fargate with maximum flexibility. Aim for 70% commitment coverage of your stable baseline. Reserve the remaining 30% as On-Demand buffer.
3. **Spot Instances** for stateless, fault-tolerant workloads (batch jobs, dev environments, CI/CD workers). Spot pricing is 60-90% below On-Demand for most instance families.
4. **Audit stopped instances and orphaned EBS** monthly. A stopped instance with a 500 GB gp3 volume costs $40/month indefinitely — create a policy to snapshot-and-terminate after 30 days idle.
5. **Upgrade to current-generation instances.** Set a policy: no instance older than two generations. The performance-per-dollar improvement usually pays for the migration effort in 2-3 months.

## Example

A B2B SaaS company runs 40 `m5.2xlarge` On-Demand instances for their application tier at $0.384/hour = ~$13,500/month. Compute Optimizer flags 15 of them as overprovisioned — they rightsize to `m7i.xlarge` ($0.2016/hour). For the remaining 25 stable instances, they buy a 1-year Compute Savings Plan at a 30% discount. Combined effect: **$4,200/month saved** (~31% reduction) with no application changes.
