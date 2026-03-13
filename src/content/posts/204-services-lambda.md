---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Service: AWS Lambda"
description: "How Lambda charges work, common cost surprises, and how to cut your serverless bill."
image:
  url: "/src/images/blog/5.jpg"
  alt: "Serverless functions"
tags:
  - services
---

## What It Is

AWS Lambda charges on two dimensions: **requests** ($0.20 per million after the free tier) and **duration** (GB-seconds of memory × execution time, billed in 1ms increments at $0.0000166667 per GB-second). In CUR, Lambda costs appear under `lineItem/ProductCode` = `AWSLambda` with separate line items for `Lambda-Requests` and `Lambda-GB-Second`. In FOCUS, filter `serviceName` = `AWS Lambda`.

Lambda also bills for **Provisioned Concurrency** ($0.0000041667 per GB-second, even when idle) and data transfer out. At scale, these secondary charges often dwarf the compute cost.

## Why It Matters

Lambda's pricing model can surprise teams moving from EC2-based cost intuition. Per-invocation billing sounds cheap — and for low-traffic functions it is — but high-throughput event-driven architectures can accumulate costs quickly.

Common surprises:

- **Over-allocated memory** — Lambda charges for the memory you configure, not what you use. A function allocated 3008 MB that only uses 400 MB is paying 7× what it needs. AWS CloudWatch metrics expose `max_memory_used` — use it.
- **Provisioned Concurrency left running** — teams enable Provisioned Concurrency to eliminate cold starts and forget to turn it off outside business hours. A 100-unit Provisioned Concurrency allocation at 512 MB costs ~$72/month 24/7, but only ~$36/month if you schedule it for 12 hours/day.
- **Recursive invocations** — a Lambda triggered by an S3 event that writes back to the same bucket can trigger itself in an infinite loop. AWS now has loop detection, but not all patterns are caught. A single incident can generate millions of unexpected invocations before the bill arrives.
- **ARM vs x86 pricing gap** — Graviton2-based Lambda (`arm64`) is 20% cheaper and often 20% faster for compute-bound functions. Most functions can be switched with a one-line change.

## How to Act

1. **Rightsize memory with AWS Lambda Power Tuning.** This open-source Step Functions state machine runs your function at multiple memory configurations and shows you the cost-performance curve. Most functions have a clear minimum — set memory there.
2. **Switch eligible functions to `arm64`.** The 20% cost reduction is automatic. Test for compatibility (native binaries compiled for x86 won't run on ARM), but for interpreted runtimes (Python, Node.js, Java on JVM) it's usually a no-op switch.
3. **Schedule Provisioned Concurrency.** Use Application Auto Scaling schedules to reduce or eliminate Provisioned Concurrency during nights and weekends for non-customer-facing functions.
4. **Set concurrency limits on non-critical functions** to prevent runaway invocation costs in error scenarios. Reserve concurrency for critical functions to ensure they get capacity.
5. **Watch duration × memory in CUR.** Sort by `lineItem/UsageAmount` × `lineItem/BlendedRate` to find the highest-cost functions — often a slow, high-memory function that's invisible in invocation counts alone.

## Example

An e-commerce platform runs an image resizing Lambda allocated 1024 MB for 50 million invocations/month at 800ms average duration. Monthly cost: **$680**. CloudWatch shows `max_memory_used` of 180 MB. They reduce memory to 256 MB (pricing drops 4×), switch to `arm64` (20% further reduction), and optimize the resize library to cut average duration to 400ms. New cost: **$85/month** — an 87% reduction with no change to the function's behavior.
