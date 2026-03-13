---
pubDate: 2026-03-09
team: "gonzalo-melosevich"
title: "Operation: Decrypt (KMS)"
description: "KMS Decrypt calls: when they appear, and how to reduce them."
image:
  url: "/src/images/blog/3.jpg"
  alt: "Encryption key"
tags:
  - operations
---

## What It Is

`Decrypt` is the AWS KMS API call that decrypts a ciphertext blob encrypted under a KMS Customer Master Key (CMK). It's invoked any time your code, an AWS service, or an SDK decrypts data — whether explicitly or transparently (e.g., fetching a secret from Secrets Manager, reading an SSE-KMS encrypted S3 object, or decrypting a DynamoDB item).

In CUR, KMS API calls appear under `lineItem/ProductCode` = `AWSKMS` with `lineItem/Operation` = `Decrypt`. In FOCUS, look for `serviceName` = `AWS Key Management Service` and `operation` = `Decrypt`. AWS charges **$0.03 per 10,000 API calls** for symmetric key operations.

## Why It Matters

KMS Decrypt charges are often the stealthiest cost in an AWS account. Each call is fractions of a cent — but production workloads can generate hundreds of millions of calls per month.

Common surprises:
- **Lambda functions re-fetching secrets** on every invocation instead of caching them. A Lambda invoked 10M times/month that calls `GetSecretValue` (which calls `Decrypt`) on each cold start can generate 10M KMS calls = $30/month just from one function.
- **SSE-KMS on high-request S3 buckets** — every `GetObject` on an SSE-KMS encrypted object calls `Decrypt`. A bucket serving 100M GET requests/month generates 100M KMS calls = $300/month.
- **Multi-region key replication** costs $1.00/month per replica key per region, on top of API charges.
- **Envelope encryption misuse** — apps that encrypt data keys per-request instead of caching and reusing them for a session window.

## How to Act

1. **Query CUR/FOCUS** for KMS `Decrypt` costs by `resourceId` (key ARN). Identify the top keys by call volume — the key ARN tells you which service or app is the caller.
2. **Enable data key caching** in the AWS Encryption SDK or your application layer. Cached data keys reuse a single `GenerateDataKey` result for N encryptions within a TTL window, dramatically reducing API calls.
3. **Cache secrets at the Lambda layer** — store fetched secrets in the Lambda execution environment (outside the handler) so they persist across warm invocations. AWS recommends combining this with Secrets Manager's built-in [Lambda extension](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html) for automatic caching.
4. **Switch SSE-KMS to SSE-S3** (AWS-managed keys) for S3 buckets where you don't need CMK control. SSE-S3 has no per-API-call charge.
5. **Audit key policies** to understand which services and IAM principals are generating calls. CloudTrail logs every KMS API call — query `eventName = Decrypt` grouped by `userIdentity.principalId`.

## Example

A fintech app stores configuration in AWS Secrets Manager and fetches it on every Lambda invocation. With 50M Lambda calls/month across all functions, that's 50M `Decrypt` operations = **$150/month** to KMS. Adding a 5-minute in-memory cache to the Lambda layer reduces KMS calls by ~95% (only cold starts fetch fresh), dropping the monthly KMS bill to under **$10/month**.
