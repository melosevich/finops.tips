---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Metric: Data Transfer Cost Ratio"
description: "Measuring how much of your cloud bill goes to moving data — and how to reduce it."
image:
  url: "/src/images/blog/6.jpg"
  alt: "Data transfer costs"
tags:
  - metrics
---

## What It Is

Data Transfer Cost Ratio measures networking and data movement costs as a percentage of total cloud spend. Data transfer charges appear across many AWS services — EC2 inter-AZ traffic, CloudFront origin pulls, S3 egress, NAT Gateway processing, and cross-region replication — and can be surprisingly hard to attribute.

The formula:

```
Data Transfer Cost Ratio = Total Data Transfer Costs / Total Cloud Spend
```

In CUR, identify data transfer costs by filtering:
- `lineItem/ProductCode` = `AmazonEC2` with `lineItem/UsageType` containing `DataTransfer` or `NatGateway`
- `lineItem/ProductCode` = `AmazonS3` with `lineItem/Operation` = `GetObject` + `lineItem/UsageType` containing `Bytes`
- `lineItem/ProductCode` = `AmazonCloudFront` for CDN egress

In FOCUS, use `ChargeCategory` = `Usage` and filter `serviceName` for EC2, CloudFront, and S3 with `resourceType` containing `Transfer`.

Industry benchmarks: for typical SaaS workloads, data transfer should represent 5-10% of total spend. Ratios above 15% usually indicate architectural issues worth investigating.

## Why It Matters

Data transfer costs are often the "mystery line item" in AWS bills — engineers who understand compute and storage pricing well are frequently surprised when they see $10,000+ in unexplained networking costs. Data transfer costs are particularly insidious because they grow with usage volume without any corresponding resource you can rightsize.

Common drivers of high Data Transfer Cost Ratio:

- **NAT Gateway processing fees** — NAT Gateway charges $0.045/GB processed in addition to the data transfer fee itself. Private instances routing all internet traffic through NAT Gateway can accumulate $5,000+/month in processing fees alone on high-throughput workloads.
- **Cross-AZ traffic** — EC2 to EC2 data transfer within the same region but across Availability Zones costs $0.01/GB in each direction. Microservices that communicate frequently across AZs can generate thousands of dollars in cross-AZ traffic monthly.
- **S3 egress** — downloading data from S3 to the internet costs $0.09/GB. Many teams use S3 for serving large files directly rather than routing through CloudFront (which has lower egress rates and caches aggressively).
- **Unintended cross-region replication** — S3 Cross-Region Replication, DynamoDB Global Tables, or RDS cross-region snapshots generate continuous data transfer charges that compound with data volume.

## How to Act

1. **Audit NAT Gateway by subnet.** Use VPC Flow Logs to identify which instances are generating the most NAT Gateway traffic. Determine if the traffic should go through a VPC endpoint instead (S3 and DynamoDB gateway endpoints are free).
2. **Use VPC Endpoints for S3 and DynamoDB.** Replacing NAT Gateway paths with Gateway VPC Endpoints eliminates both the NAT Gateway processing fee and the data transfer charge for traffic to these services. This is a zero-downtime change with immediate cost impact.
3. **Co-locate services in the same AZ for high-throughput internal communication.** For services that exchange GBs/hour internally, same-AZ placement eliminates cross-AZ transfer charges. Use placement groups or target specific subnets in your IaC.
4. **Serve large files through CloudFront, not S3 direct.** CloudFront's data transfer rate is lower than S3 direct egress ($0.0085-0.085/GB vs S3's flat $0.09/GB), and cached content eliminates repeat origin transfers entirely.
5. **Build a monthly "data transfer cost breakdown" report.** Break down transfer costs by source service, type (cross-AZ, cross-region, internet egress), and destination. Visibility is the first step — teams can't reduce what they can't see.

## Example

An analytics platform pays $22,000/month in data transfer costs against $150,000 total spend — a **14.7% ratio**. Investigation finds $8,000 is NAT Gateway processing (data scientists pulling large datasets from the internet through NAT instead of via S3 VPC endpoints), and $6,000 is cross-AZ traffic between their ingestion and processing services. They add S3 and DynamoDB VPC endpoints ($8,000 eliminated) and co-locate ingestion and processing in `us-east-1a` ($4,800 reduced). New ratio: **6.1%** — **$13,200/month saved**.
