---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Operation: DescribeInstances (EC2)"
description: "EC2 API calls are free — but the patterns behind them reveal costly infrastructure waste."
image:
  url: "/src/images/blog/3.jpg"
  alt: "Cloud infrastructure"
tags:
  - operations
---

## What It Is

`DescribeInstances` is the EC2 API call that returns information about your instances — their state, type, tags, network configuration, and more. Unlike most AWS API operations, **EC2 Describe calls have no per-call charge**. However, `DescribeInstances` is one of the most valuable diagnostic signals in your FinOps toolkit because the pattern of what tools and processes are calling it reveals infrastructure management health.

In CUR/FOCUS, you won't see a line item for `DescribeInstances` itself. But you will find it in CloudTrail logs and in Cost Explorer as an indirect signal — high-frequency Describe API calls indicate active tooling interrogating your infrastructure, and that tooling often drives the compute costs you're trying to understand.

## Why It Matters

Even though `DescribeInstances` is free, it matters for three reasons:

- **It reveals what's running.** The response to `DescribeInstances` is the ground truth of your running fleet. Teams that haven't called it systematically in a while often discover instances they forgot about. A t3.large left running for 6 months costs **~$600** at on-demand rates.
- **Excessive polling is a smell.** Tools that call `DescribeInstances` every 10-30 seconds are often trying to work around a missing event-driven architecture. That same polling pattern often drives unnecessary instance launches, health-check restarts, and over-provisioned fleets.
- **API rate limits at scale.** High-volume `DescribeInstances` calls can hit the EC2 API rate limit (typically 100 calls/second per region, with burst), causing throttling errors that delay automation and affect reliability — and lead teams to over-provision "just in case."

Common discoveries:

- **Zombie instances** — instances in `stopped` state still attached to EBS volumes (which still bill at full volume rate). `DescribeInstances` filtered by state=stopped reveals these immediately.
- **Untagged instances** — instances with no cost allocation tags that can't be attributed to a team or service.
- **Instances in wrong purchase class** — `DescribeInstances` returns `instanceLifecycle` (spot/scheduled) and you can cross-reference with reservations to find on-demand instances running where Reserved coverage should apply.
- **Instances in unexpected regions** — a full `DescribeInstances` sweep across all regions (using `--region` or `aws ec2 describe-regions` + iteration) reveals shadow IT or forgotten test environments in regions you don't expect.

## How to Act

1. **Run a full fleet audit** periodically: `aws ec2 describe-instances --query 'Reservations[].Instances[].[InstanceId,State.Name,InstanceType,Tags]' --output table`. Look for stopped, untagged, and unexpected instances.
2. **Use AWS Resource Explorer** or **AWS Config** to get a cross-region inventory without scripting per-region Describe calls.
3. **Set up Config Rules for tagging compliance** — automatically flag instances missing required cost allocation tags (team, environment, service).
4. **Delete stopped instances and their EBS volumes** if they're not needed. A stopped instance still bills for attached EBS volumes. Use `aws ec2 describe-instances --filters Name=instance-state-name,Values=stopped` to find them.
5. **Replace polling patterns with EventBridge** — instead of tools that poll `DescribeInstances` on a schedule, use EC2 state-change events (EventBridge) to trigger automation only when instances actually change state.
6. **Enable Compute Optimizer for the fleet** — Compute Optimizer ingests instance type, CloudWatch metrics, and runs pattern to recommend right-sizing changes. It requires no per-instance Describe polling on your part.

## Example

A platform team audits their AWS account and runs `DescribeInstances` across all regions for the first time in a year. They find: 12 stopped instances in us-east-1 with attached EBS volumes (total: 2.4 TB = **$240/month** in volume costs), 3 running t3.xlarge instances in eu-west-2 from a test project (at $0.2048/hour = **$444/month combined**), and 45 instances missing the `team` tag (making cost attribution impossible). Total savings from cleanup: **$684/month**.
