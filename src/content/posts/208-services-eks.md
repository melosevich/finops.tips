---
pubDate: 2026-03-13
team: "gonzalo-melosevich"
title: "Service: Amazon EKS"
description: "EKS cost structure, the hidden charges in Kubernetes on AWS, and how to optimize."
image:
  url: "/src/images/blog/10.jpg"
  alt: "Kubernetes clusters"
tags:
  - services
---

## What It Is

Amazon EKS (Elastic Kubernetes Service) charges **$0.10/hour per cluster** (~$73/month) for the control plane, plus all underlying infrastructure you provision: EC2 nodes (or Fargate pods), EBS volumes, load balancers, and data transfer. In CUR, the cluster fee appears under `lineItem/ProductCode` = `AmazonEKS`, while worker node costs appear under `AmazonEC2`. In FOCUS, filter `serviceName` = `Amazon Elastic Kubernetes Service` for the control plane and `Amazon Elastic Compute Cloud` for nodes.

EKS costs are deceptive because the control plane fee is small relative to total cluster spend — 95% of EKS costs are EC2, EBS, and networking, which don't appear in the EKS line item.

## Why It Matters

Kubernetes on AWS introduces unique cost challenges: workload bin-packing efficiency, namespace-level cost attribution, and the interaction between the Kubernetes scheduler and AWS billing primitives. Teams that manage costs at the cluster level without workload-level visibility are flying blind.

Common surprises:

- **One cluster per environment** proliferates control plane costs. At $73/month per cluster, 10 dev/test clusters = $730/month in control plane fees alone — before any worker nodes. Namespace-based isolation within shared clusters is usually sufficient for non-production.
- **Over-provisioned node groups** — Kubernetes schedulers reserve nodes based on requested resources, not actual usage. A pod requesting 2 CPU and 4 GB RAM on a node with 4 vCPU/8 GB RAM leaves the other half idle but billed. CPU request/limit ratios above 3× signal over-requesting.
- **Unused load balancers from orphaned services** — deleting a Kubernetes `Service` of type `LoadBalancer` also deletes the ELB. But teams that delete namespaces or reinstall charts without cleanup leave ALBs running at $0.008/LCU-hour.
- **Fargate pricing** — Fargate-on-EKS charges per vCPU-second and GB-second with a 1-minute minimum. For long-running workloads, EC2 with Savings Plans is almost always cheaper. Fargate's value is burst capacity and isolation, not steady-state compute.

## How to Act

1. **Consolidate dev/test clusters into shared clusters with namespaces.** Use RBAC and network policies for isolation. Eliminate control plane costs for non-production environments. Reserve dedicated clusters only where strict isolation is a hard requirement.
2. **Enable Karpenter or Cluster Autoscaler with EC2 Spot.** Karpenter provisions nodes on-demand matching actual pod requirements and can mix Spot and On-Demand in the same node pool. Spot can reduce worker node costs by 60-80% for batch and stateless workloads.
3. **Audit pod resource requests.** Use Vertical Pod Autoscaler (VPA) in recommendation mode to see actual vs. requested resource usage. Reduce CPU/memory requests for over-requesting workloads — this directly increases bin-packing efficiency and reduces the number of nodes needed.
4. **Tag namespaces for cost allocation.** Use the AWS Cost Allocation Tags on node groups and apply Kubernetes labels that map to cost centers. Tools like Kubecost or AWS Cost Explorer's split-cost allocation data can break down cluster costs by namespace or workload.
5. **Right-choose Fargate vs. EC2.** Use Fargate for short-lived jobs, isolated workloads, or burst capacity. Use EC2 + Savings Plans for stable, long-running services. The break-even is roughly 10 minutes of runtime — below that, Fargate's per-second billing is competitive; above it, EC2 wins.

## Example

A platform team runs 8 EKS clusters ($584/month in control plane alone) — two per environment (app and data). They consolidate to 4 clusters using namespaces for team isolation. They enable Karpenter with Spot for all stateless workloads (60% of total compute), and use VPA recommendations to reduce average node count from 45 to 31 by fixing over-requesting pods. Result: **$28,000/month → $16,000/month** — a 43% reduction, with better autoscaling behavior as a bonus.
