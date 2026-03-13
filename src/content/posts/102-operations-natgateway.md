---
pubDate: 2026-03-10
team: "gonzalo-melosevich"
title: "Operation: NatGateway"
description: "Why NAT Gateway costs spike and what to check first."
image:
  url: "/src/images/blog/2.jpg"
  alt: "Network traffic"
tags:
  - operations
---

## What It Is

NAT Gateway is an AWS managed service that lets instances in private subnets reach the internet without exposing them to inbound connections. In CUR, NAT Gateway costs appear under `lineItem/ProductCode` = `AmazonEC2` with `lineItem/Operation` as either `NatGateway` (for hourly charges) or `NatGatewayBytes` (for data processing charges). In FOCUS, filter `serviceName` = `Amazon Virtual Private Cloud` and `operation` = `NatGateway` or `NatGatewayBytes`.

Pricing has two components: **$0.045/hour** per gateway (regardless of traffic) plus **$0.045/GB** of data processed in each direction.

## Why It Matters

NAT Gateway frequently appears in the top 5 unexpected cost drivers for AWS accounts. The data processing charge is symmetric — you pay for both inbound and outbound bytes flowing through the gateway. This catches teams off guard when they assume they're only paying for egress.

Common surprises:
- **Cross-AZ traffic** — if your app in us-east-1a talks to an S3 endpoint or RDS in us-east-1b via NAT Gateway, you pay the $0.045/GB processing charge plus cross-AZ data transfer costs. Deploying a NAT Gateway per AZ reduces cross-AZ charges but multiplies the hourly cost.
- **Chatty microservices** repeatedly polling S3 or DynamoDB via NAT Gateway instead of using VPC endpoints (which are free for gateway endpoints).
- **Idle gateways** — teams deploy NAT Gateways per environment and forget to tear down staging or ephemeral environments.

## How to Act

1. **Query CUR/FOCUS** for `NatGatewayBytes` by `availabilityZone` and `resourceId`. High processing bytes in a single AZ usually signals cross-AZ traffic.
2. **Deploy VPC Gateway Endpoints** for S3 and DynamoDB immediately — they route traffic over AWS's private network at zero cost and eliminate NAT Gateway bytes for those services.
3. **Deploy VPC Interface Endpoints** for other AWS services (SQS, SNS, ECR) if data volumes are high enough to justify the $0.01/hour + $0.01/GB endpoint pricing.
4. **Audit idle gateways** — `aws ec2 describe-nat-gateways --filter Name=state,Values=available` and cross-reference with CloudWatch `BytesOutToDestination` to find unused ones.
5. **Consider NAT instances** for low-traffic environments — a t4g.nano at ~$3/month vs $32/month minimum for a NAT Gateway.

## Example

A SaaS startup has three environments (prod, staging, dev) each with a NAT Gateway per AZ (6 gateways total). Staging and dev run 24/7 but process minimal traffic. Hourly cost alone: 4 idle gateways × $0.045 × 730 hours = **$131/month** wasted. Consolidating to a single NAT Gateway per non-prod environment and adding S3/DynamoDB VPC endpoints saves ~$180/month with one afternoon of work.
