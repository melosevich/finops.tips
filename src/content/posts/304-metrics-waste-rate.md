---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Metric: Waste Rate"
description: "How to define, calculate, and systematically eliminate cloud waste across your AWS account."
image:
  url: "/src/images/blog/2.jpg"
  alt: "Waste reduction"
tags:
  - metrics
---

## What It Is

Waste Rate measures the percentage of your cloud spend attributable to resources that deliver zero business value: idle instances, unattached volumes, unused Elastic IPs, empty load balancers, and orphaned snapshots. Unlike utilization metrics (which measure efficiency of active resources), Waste Rate focuses on spend that has no working baseline — it's pure elimination opportunity.

The formula:

```
Waste Rate = Identified Waste Spend / Total Cloud Spend
```

In CUR, waste can be identified by combining resource state data (from Config or Trusted Advisor) with cost line items. Key waste categories:

- **Unattached EBS volumes**: `ec2 describe-volumes --filters Name=status,Values=available`
- **Stopped EC2 instances**: `ec2 describe-instances --filters Name=instance-state-name,Values=stopped`
- **Unused Elastic IPs**: unassociated EIPs appear in `aws ec2 describe-addresses` where `AssociationId` is null
- **Idle load balancers**: ALBs with 0 active targets or 0 requests over 7 days

## Why It Matters

Waste Rate is distinct from other FinOps KPIs because it requires no architectural tradeoff — waste is, by definition, spend with no corresponding value. Reducing waste has 100% ROI with no performance or reliability risk.

Industry benchmarks suggest 20-35% of cloud spend in organizations without an active FinOps practice is waste. Mature FinOps teams target <5% Waste Rate.

Common misses when calculating Waste Rate:

- **Stopped instances are not free.** A stopped EC2 instance doesn't charge for compute, but its EBS volumes, Elastic IPs, and reserved instance commitments still bill. Include the associated resource costs.
- **"Idle" ≠ "zero value"** — some stopped instances serve as cold standby. Apply business context before terminating. Use tags like `environment=cold-standby` to exempt intentional idle resources.
- **Waste Rate excludes overprovisioning.** A running EC2 instance at 5% CPU utilization is wasteful but not captured in Waste Rate — that's a rightsizing opportunity tracked separately.

## How to Act

1. **Enumerate waste categories weekly with a script.** Build a resource inventory from EC2, EBS, EIP, ELB, and Snapshot APIs. Cross-reference with CloudWatch to identify zero-traffic or zero-activity resources over the past 7 days.
2. **Tag resources at launch with owner and expiry.** If a resource has no owner tag, treat it as a candidate for waste. Send weekly "orphaned resource" digest emails to team leads, with the associated monthly cost per resource.
3. **Set a stop-then-terminate policy.** Don't delete immediately — stop EC2 instances and tag them with a deletion date 30 days out. This gives owners time to reclaim before termination.
4. **Automate EIP and EBS cleanup.** Unattached EIPs and detached EBS volumes rarely have a legitimate owner after 7 days. Automate snapshot-and-terminate for EBS and release for EIPs.
5. **Report Waste Rate monthly to engineering leadership.** Visibility drives action. Include the dollar amount alongside the percentage — "$12,000/month in waste" lands differently than "3% waste rate."

## Example

A team audits their AWS account and finds: 32 unattached EBS volumes ($256/month), 18 stopped EC2 instances with EBS ($1,100/month), 11 unused EIPs ($42/month), and 3 empty ALBs ($54/month). Total waste: **$1,452/month** against $80,000 total spend = **1.8% Waste Rate**. After automated cleanup and owner-tagging enforcement, they reduce to $220/month in intentionally retained standby resources — **0.28% Waste Rate** and **$1,232/month recovered**.
