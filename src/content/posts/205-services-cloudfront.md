---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Service: Amazon CloudFront"
description: "What CloudFront charges for, where costs hide, and how to optimize CDN spend."
image:
  url: "/src/images/blog/6.jpg"
  alt: "Content delivery network"
tags:
  - services
---

## What It Is

Amazon CloudFront is AWS's content delivery network (CDN). It charges on three primary axes: **data transfer out to the internet** (price varies by edge location and volume, starting at $0.0085/GB in North America), **HTTP/S requests** ($0.0100 per 10,000 requests for HTTPS), and **data transfer from origin to CloudFront** (origin shield and regional edge cache fetches). In CUR, CloudFront costs appear under `lineItem/ProductCode` = `AmazonCloudFront`. In FOCUS, filter `serviceName` = `Amazon CloudFront`.

CloudFront pricing uses **price classes** — you can restrict distribution to cheaper regions and accept lower geographic coverage in exchange for lower per-GB rates.

## Why It Matters

CloudFront is often treated as a "set it and forget it" service, but CDN spend can become a significant line item for media-heavy or high-traffic workloads. The billing model has nuances that catch teams off guard.

Common surprises:

- **Real-Time Logs to Kinesis** — enabling CloudFront real-time logs at 100% sampling rate generates substantial Kinesis Data Streams costs that appear on the Kinesis line item, not CloudFront. Teams diagnose a mystery Kinesis spike without realizing CloudFront created it.
- **Invalidation costs** — the first 1,000 invalidation paths per month are free; beyond that, $0.005 per path. A CI/CD pipeline that invalidates `/\*` (counts as one path) is fine; one that invalidates individual file paths at scale can generate unexpected charges.
- **WAF on every distribution** — AWS WAF charges $5/month per WebACL plus $1/month per rule plus $0.60 per million requests. Attaching WAF to every CloudFront distribution, including internal or low-traffic ones, multiplies these fixed costs unnecessarily.
- **Price class default is "all edge locations"** — this includes expensive regions (South America, Australia, India). For internal tools or geographically limited audiences, `PriceClass_100` (North America + Europe only) cuts data transfer costs by 20-40%.

## How to Act

1. **Set the right Price Class.** Audit each distribution: who are the actual end users? If your audience is North America and Europe, switch to `PriceClass_100`. The global CDN is only worth paying for if you have genuinely global traffic.
2. **Tune cache TTLs aggressively.** Cache-Hit Ratio is CloudFront's most important efficiency metric — every cache miss generates both an origin fetch (which you pay for twice) and slower response times. Aim for >80% cache-hit ratio on static assets. Use `Cache-Control: max-age=31536000` for versioned assets.
3. **Enable Compression.** CloudFront can gzip/Brotli-compress responses automatically. Compressed transfers are smaller, reducing both data transfer costs and latency. Enable it at the behavior level.
4. **Use Origin Shield** only for origins with high replication costs. Origin Shield adds one extra caching layer to reduce origin load but adds a per-request fee ($0.0090 per 10,000 requests). Do the math for your cache hit ratio before enabling it everywhere.
5. **Review real-time log sampling rates.** If you need logs for debugging, use 1-5% sampling rather than 100%. Full sampling is expensive; for most observability use cases, sampled logs are sufficient.

## Example

A SaaS company serves 50 TB/month through CloudFront with the default "all edge locations" price class. Most customers are in the US and EU. Switching to `PriceClass_100` reduces their blended data transfer rate from $0.0092/GB to $0.0075/GB — a **$850/month saving** on data transfer alone. They also raise their static asset TTL from 1 hour to 1 year (using versioned filenames), pushing cache-hit ratio from 65% to 92%, which cuts origin fetches by 78% and eliminates $300/month in origin data transfer charges.
