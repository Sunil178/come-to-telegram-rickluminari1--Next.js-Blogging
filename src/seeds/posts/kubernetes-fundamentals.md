---
title: "Kubernetes Fundamentals: Orchestrating Containers at Scale"
titleDescription: "Pods, Deployments, and Services — the three objects that get you most of the way"
categorySlug: "technology"
tags: ["Kubernetes", "DevOps", "Containers"]
bannerImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c"
summary: "Kubernetes isn't just 'Docker but bigger' — it's a control system that keeps declaring what you want until reality matches it."
published: true
publishedAt: "2026-04-15"
approval: "Approved"
approvedAt: "2026-04-16"
visitorCount: 1580
---

Docker solves how to package and run one container. Kubernetes solves a different problem: you have dozens or hundreds of containers, spread across many machines, and you need them to stay running, scale under load, recover from crashes, and get network traffic routed to them correctly — without a human manually restarting things at 3am. Kubernetes doesn't run containers directly; it runs a **control loop** that continuously compares the state you declared against the state that actually exists, and takes action to close the gap.

> "Kubernetes is a platform for building platforms. It's a better place to start; not the endgame." — Kelsey Hightower

## The core objects, in the order you'll actually use them

**Pod** — the smallest deployable unit. Almost always one container (sometimes a tightly coupled pair, like an app and a logging sidecar), given its own IP address inside the cluster. You rarely create Pods directly.

**Deployment** — describes how many replicas of a Pod should be running and how to roll out changes to them. This is what you actually write:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blog-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: blog-app
  template:
    metadata:
      labels:
        app: blog-app
    spec:
      containers:
        - name: blog-app
          image: registry.example.com/blog-app:1.4.0
          ports:
            - containerPort: 3000
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

Apply this, and Kubernetes doesn't just start three Pods once — it keeps three running, permanently. Kill one by hand (`kubectl delete pod ...`) and the Deployment's controller notices the mismatch between "3 desired" and "2 actual," and starts a replacement within seconds. That's the control loop in action: it isn't a one-time script, it's a standing guarantee.

**Service** — Pods are ephemeral and get a new IP every time they're recreated, so nothing should ever talk to a Pod's IP directly. A Service gives a stable name and IP that load-balances across whichever Pods currently match its label selector:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: blog-app-svc
spec:
  selector:
    app: blog-app
  ports:
    - port: 80
      targetPort: 3000
```

Other Pods in the cluster reach this by name (`blog-app-svc`) — DNS resolves it, and Kubernetes routes each request to one of the healthy Pods behind it, regardless of how many times those Pods have been recreated underneath.

## Resource requests and limits aren't optional details

The `resources` block in the Deployment above is easy to skip and expensive to skip. `requests` is what the scheduler uses to decide which node has room for this Pod; `limits` is the hard ceiling the container is not allowed to exceed. Skip `requests`, and the scheduler can pack Pods onto a node with no real headroom, because it has no idea how much each one actually needs. Skip `limits`, and one runaway Pod can starve every other Pod sharing that node of memory or CPU.

## Readiness and liveness probes

Kubernetes needs to know two different things about a running container: is it alive, and is it ready for traffic. These aren't the same question — an app can be alive (the process hasn't crashed) while still being unready (it's mid-startup, warming a cache, or temporarily overloaded):

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 3000
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  periodSeconds: 5
```

A failed liveness probe gets the container restarted. A failed readiness probe just pulls it out of the Service's rotation temporarily — no traffic gets routed to it until it reports ready again, but Kubernetes doesn't kill it for that alone. Conflating the two is a common source of Pods being restarted for problems a restart can't actually fix, like a slow downstream dependency.

## Namespaces: cheap isolation, not a security boundary

A `Namespace` scopes names and RBAC permissions — `staging` and `production` can each have their own `blog-app` Deployment without colliding. It's a useful organizational unit, but it isn't a hard security boundary: Pods in different namespaces can still reach each other over the network by default, unless a `NetworkPolicy` says otherwise.

## What Kubernetes deliberately doesn't do for you

It's worth being clear-eyed about the scope: Kubernetes orchestrates containers, but it doesn't build your images (that's Docker's job, or a CI pipeline), doesn't manage your database's actual data durability (that's the database, plus wherever the underlying storage lives), and doesn't replace monitoring or logging (that's Prometheus, Grafana, and friends, layered on top). Kubernetes is the scheduler and the control loop — genuinely powerful for exactly that job, and worth reaching for once you actually have the operational complexity it's built for, not before.
