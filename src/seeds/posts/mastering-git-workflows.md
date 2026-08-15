---
title: "Mastering Git: Workflows for Teams"
titleDescription: "Branching strategies, rebase vs. merge, and the commands that actually get used daily"
categorySlug: "technology"
tags: ["Git", "Version Control", "Collaboration"]
bannerImage: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5"
summary: "Git is simple at the core and confusing at the edges — here's the mental model that makes the edges make sense."
published: true
publishedAt: "2026-06-24"
approval: "Approved"
approvedAt: "2026-06-25"
visitorCount: 1980
---

Git's mental model is simpler than its reputation suggests: a commit is a snapshot, not a diff — every commit points to the complete state of the project at that moment, plus a pointer to its parent commit(s). A branch is nothing more than a movable label pointing at a commit. Once that clicks, most of Git's commands stop feeling like a memorized incantation and start feeling like straightforward operations on a graph of snapshots.

> "I'm an egotistical bastard, and I name all my projects after myself. First 'Linux', now 'git'." — Linus Torvalds, on naming the tool

## Branching strategies: pick one, don't improvise per-feature

**Trunk-based development** — everyone commits small, frequent changes to `main` (often behind feature flags for anything not ready to be user-facing), with short-lived branches merged within a day or two. This favors fast integration and works best with strong CI and a team disciplined about small changes.

**GitHub Flow** — a lightweight variant: branch off `main`, open a pull request, review, merge, deploy. No `develop` branch, no release branches — `main` is always deployable. This is the default a huge number of teams (and most open-source projects) actually use today.

**Git Flow** — a heavier model with dedicated `develop`, `feature/*`, `release/*`, and `hotfix/*` branches, originally designed for software with scheduled, versioned releases. It's still the right fit for that specific case (shipping distinct numbered versions, like a desktop app or a library), but it's meaningfully more process than most continuously-deployed web apps need, and adopting it by default for a project that ships continuously is usually more overhead than benefit.

## Merge vs. rebase: they answer different questions

```
Before:
main:     A---B---C
feature:       \---D---E
```

**Merge** creates a new commit that ties both histories together, preserving exactly what happened, including the branch structure:

```
After merge:
main:     A---B---C-------F
feature:       \---D---E-/
```

**Rebase** replays your commits on top of the target branch, producing a linear history as if you'd branched off the latest commit from the start:

```
After rebase (feature onto main), then merge:
main:     A---B---C---D'---E'
```

Neither is universally correct. Merge preserves true history — useful when you want an honest record of when branches diverged and rejoined, and it's the safer default for anything that's already been pushed and might be in use elsewhere. Rebase produces a cleaner, linear history that's easier to read later — but it rewrites commit hashes, which is why the standard rule is: never rebase commits that have already been pushed to a shared branch someone else might be building on. Rebasing your own local, not-yet-pushed feature branch before opening a PR is common and safe; rebasing `main` after others have already pulled it is how you get a team's local histories out of sync with each other.

## The commands that cover most days

```bash
git switch -c feature/add-search    # create and switch to a new branch
git add -p                          # stage changes interactively, hunk by hunk
git commit -m "Add search endpoint"
git fetch origin                    # get remote changes without merging them yet
git rebase origin/main              # replay local commits on top of the latest main
git push --force-with-lease         # push a rebased branch — safer than --force
```

`--force-with-lease` deserves calling out specifically: plain `--force` overwrites the remote branch unconditionally, even if someone else pushed to it since you last fetched, silently discarding their work. `--force-with-lease` refuses to push if the remote branch has moved since your last fetch — it forces *your* rewritten history, but only if nothing you didn't already know about is at risk of being lost.

## Interactive rebase for cleaning up before a PR

```bash
git rebase -i HEAD~3
```

Opens an editor listing your last three commits, letting you reorder, squash (combine into one), reword commit messages, or drop commits entirely — before anyone else has seen this branch. This is how "wip", "fix typo", "actually fix it this time" become one clean, reviewable commit, without those intermediate missteps living in history forever.

## A habit worth more than any specific command

The single highest-leverage Git habit isn't a command at all — it's writing commits that each represent one coherent, reviewable change, with a message that explains *why*, not just *what* (the diff already shows what changed). `git blame` and `git log -p <file>` are only as useful as the commit messages behind them; six months from now, "fix bug" tells a future reader nothing that the diff doesn't already show, while "fix race condition in vote counter — concurrent votes could double-increment" tells them exactly what to trust and what to double-check.
