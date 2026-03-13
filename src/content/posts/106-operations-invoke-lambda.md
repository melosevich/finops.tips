---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Operation: Invoke (Lambda)"
description: "Lambda Invoke costs: the two dimensions of Lambda billing and where surprises hide."
image:
  url: "/src/images/blog/3.jpg"
  alt: "Function execution"
tags:
  - operations
---

## What It Is

`Invoke` is the Lambda API call that executes a function — whether triggered synchronously (API Gateway, SDK call), asynchronously (S3 event, SNS), or via event source mapping (SQS, Kinesis, DynamoDB Streams). In CUR, Lambda charges appear under `lineItem/ProductCode` = `AWSLambda` with two distinct `lineItem/Operation` values: `Invoke` (request count) and `Lambda-GB-Second` (duration × memory). In FOCUS, look for `serviceName` = `AWS Lambda`.

Lambda billing has two dimensions: **$0.20 per million requests** and **$0.0000166667 per GB-second** of compute. AWS provides a permanent free tier of 1M requests and 400,000 GB-seconds per month. Duration is rounded up to the nearest 1ms.

## Why It Matters

Lambda's per-invocation pricing makes cost scaling non-obvious. Common surprises:

- **Over-provisioned memory** — Lambda bills on allocated memory × duration, not actual memory used. A function configured at 3,008 MB that only uses 200 MB pays 15× more than necessary for the compute dimension.
- **Recursive invocations gone wrong** — a Lambda triggered by an S3 event that writes back to the same bucket, or an SQS function with a misconfigured dead-letter queue, can generate millions of invocations in minutes. One incident can generate **thousands of dollars in hours**.
- **Synchronous API Gateway integrations at scale** — a high-traffic REST API where every request triggers a Lambda invocation. At 100M requests/month, request charges alone are **$20/month**, but duration charges depend heavily on function efficiency and memory settings.
- **SQS polling inefficiency** — Lambda's SQS event source mapping polls continuously. If messages are sparse and the function does minimal work, you pay for many short, low-value invocations.
- **Cold start padding** — some teams over-provision memory to speed up cold starts, inadvertently inflating GB-second costs across all warm invocations too.

## How to Act

1. **Query CUR/FOCUS** for Lambda `Lambda-GB-Second` costs by function name (use `lineItem/ResourceId`). High GB-second cost with low invocation count means over-provisioned memory; high invocation count with moderate GB-second cost means call volume is the driver.
2. **Use AWS Lambda Power Tuning** (open-source Step Functions state machine) to find the memory setting that minimizes cost × duration for each function. For compute-bound functions, more memory can reduce duration enough to lower total cost.
3. **Set concurrency limits and reserved concurrency** to cap blast radius from runaway invocation loops. A function that shouldn't exceed 100 concurrent executions shouldn't be able to spin up 1,000.
4. **Enable Lambda Insights** (CloudWatch) to monitor actual memory usage per invocation and identify functions where allocated ≫ used.
5. **Batch SQS messages** — increase `batchSize` on SQS event source mappings to process more messages per invocation. This reduces request charges and overhead.
6. **Use ARM (Graviton2) architecture** — Lambda on `arm64` costs 20% less per GB-second than `x86_64` and often runs faster for equivalent workloads.

## Example

A webhook processing function is configured at 1,024 MB and runs for an average of 800ms per invocation, handling 20M invocations/month. GB-second cost: 20M × (1,024/1,024) × 0.8s = 16M GB-seconds × $0.0000166667 = **$266/month**. Power tuning reveals the function only needs 256 MB and runs in 600ms at that memory. New cost: 20M × 0.25 × 0.6s = 3M GB-seconds = **$50/month** — an **81% reduction**.
