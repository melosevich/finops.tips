---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Operation: RunInstances (EC2)"
description: "EC2 RunInstances: what it costs to launch instances, and how launch patterns shape your bill."
image:
  url: "/src/images/blog/2.jpg"
  alt: "Server rack"
tags:
  - operations
---

## What It Is

`RunInstances` is the EC2 API call that launches one or more instances. It's how every EC2 instance — whether started manually, by Auto Scaling, by ECS/EKS, or by a CI/CD pipeline — comes into existence. In CUR, EC2 instance charges appear under `lineItem/ProductCode` = `AmazonEC2` with `lineItem/Operation` = `RunInstances` (or `RunInstances:<purchase-option>` for Reserved Instance or Spot variants). In FOCUS, look for `serviceName` = `Amazon Elastic Compute Cloud` and `operation` = `RunInstances`.

Unlike most API calls, `RunInstances` itself has no per-call charge — the cost is the instance runtime that follows. EC2 is billed per second (minimum 60 seconds) for Linux instances, and per hour for Windows. The instance type and region determine the on-demand rate, which can range from $0.006/hour (t4g.nano) to $32+/hour (p4d.24xlarge).

## Why It Matters

`RunInstances` patterns directly reveal cost efficiency problems. Common surprises:

- **Oversized instance types** launched by default because nobody revisited the original sizing. A c5.4xlarge at $0.68/hour running 24/7 costs **$489/month**; a right-sized c5.xlarge at $0.17/hour costs **$122/month** — a 75% saving for the same workload.
- **Short-lived instances launched frequently** — CI/CD pipelines that spin up a fresh instance per build job pay a minimum 60-second charge even for a 10-second build, plus AMI boot time. At 1,000 builds/day on a t3.medium, that's ~$30/day in wasted boot minimums alone.
- **Auto Scaling launching on-demand when Spot would suffice** — stateless, fault-tolerant workloads (batch processing, test runners, ML training) running as on-demand instances instead of Spot can cost 70-90% more.
- **Instances left running after use** — dev/test environments, ML training jobs, and one-off analysis instances that aren't terminated after the work is done.
- **Wrong purchase option** — steady-state production workloads not covered by Reserved Instances or Savings Plans pay on-demand rates.

## How to Act

1. **Query CUR/FOCUS** for EC2 costs grouped by `instanceType` and `purchaseOption`. Find your highest-cost instance types and check their utilization in CloudWatch.
2. **Right-size with Compute Optimizer** — AWS Compute Optimizer analyzes CloudWatch metrics and recommends instance type changes. Look for "over-provisioned" flags.
3. **Use Spot Instances for interruptible workloads** — set your Auto Scaling group to use a mixed fleet (on-demand base capacity + Spot for burst). Target Spot pools with lower interruption rates using the `capacity-optimized` allocation strategy.
4. **Enforce instance scheduler tags** — tag dev/test instances with start/stop schedules and enforce them with AWS Instance Scheduler or EventBridge rules. Stopping instances nights and weekends can cut dev costs by 65%.
5. **Buy Savings Plans** for your predictable baseline — EC2 Instance Savings Plans offer 40-60% discount over on-demand for committed usage ($/hour).
6. **Set up launch guardrails** — use Service Control Policies (SCPs) or AWS Config rules to prevent launches of unapproved, oversized instance types in non-production accounts.

## Example

A data team runs nightly ETL jobs on a fleet of r5.2xlarge instances (on-demand, $0.504/hour). Jobs run 4 hours, 7 days/week = 28 hours/week × $0.504 = **$14.11/week per instance**. With 10 instances, that's **$141/week ($612/month)**. Switching to Spot r5.2xlarge (typically ~$0.15/hour) drops the fleet cost to **$42/week ($182/month)** — a **70% saving** for jobs designed to retry on interruption.
