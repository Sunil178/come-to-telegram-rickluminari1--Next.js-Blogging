---
title: "Mastering TypeScript Generics: A Practical Guide"
titleDescription: "Writing reusable, type-safe code without resorting to `any`"
categorySlug: "technology"
tags: ["TypeScript", "JavaScript", "Programming"]
bannerImage: "https://images.unsplash.com/photo-1550439062-609e1531270e"
summary: "Generics let you write one function or type that works correctly across many shapes of data — here's how to actually reach for them."
published: true
publishedAt: "2026-03-11"
approval: "Approved"
approvedAt: "2026-03-12"
visitorCount: 1870
---

The first time most people meet generics, it's by accident — they write `Array<string>` or `Promise<void>` without thinking about what the angle brackets mean. But generics aren't special syntax bolted onto arrays and promises; they're a general tool for writing a function, class, or type once and having it stay precise for whatever type it's used with. Understanding them properly is the difference between reaching for `any` out of frustration and writing code the compiler can actually help you with.

## The problem generics solve

Say you want a function that returns the first element of an array:

```ts
function first(arr: any[]): any {
  return arr[0];
}

const num = first([1, 2, 3]); // typed `any` — TypeScript has lost track
num.toFixed(2); // no error here even if `num` turns out to be a string
```

`any` compiles, but it throws away every guarantee TypeScript could have given you. A generic keeps the connection between input and output:

```ts
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

const num = first([1, 2, 3]); // inferred as number | undefined
const str = first(["a", "b"]); // inferred as string | undefined
```

`T` is a type variable — a placeholder that gets filled in with whatever type you actually call the function with. TypeScript infers it from the argument, and every use of `T` in the return type stays consistent with that inference.

## Constraining generics with `extends`

An unconstrained `T` can be anything, which sometimes means you can't do much with it. `extends` narrows the set of types `T` is allowed to be:

```ts
interface HasId {
  id: string;
}

function findById<T extends HasId>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}
```

Now `findById` only accepts arrays of objects that have an `id: string` field — and inside the function, TypeScript knows `item.id` exists, because the constraint guarantees it.

## Generic constraints with `keyof`

A very common and genuinely useful pattern: a function that picks a property off an object, typed so the key has to actually exist on that object:

```ts
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const post = { title: "Hello", views: 120 };
const title = getProp(post, "title"); // string
const views = getProp(post, "views"); // number
getProp(post, "author"); // compile error: "author" is not a key of `post`
```

`K extends keyof T` means "K has to be one of T's actual property names." The return type `T[K]` — an *indexed access type* — then resolves to whatever that specific property's type is. This is how library functions like Lodash's `get` or React's `useState` setters stay type-safe across arbitrary shapes.

## Generic interfaces and default type parameters

Generics apply to types and interfaces just as well as functions — this is how you'd model an API response wrapper that's reused across many endpoints:

```ts
interface ApiResponse<TData = unknown> {
  data: TData;
  error: string | null;
  status: number;
}

async function fetchPost(slug: string): Promise<ApiResponse<{ title: string; content: string }>> {
  const res = await fetch(`/api/posts/${slug}`);
  return res.json();
}
```

The `= unknown` default means `ApiResponse` still works if you don't specify `TData` — it just falls back to the safest possible type instead of silently becoming `any`.

## A quick reference

| Pattern | What it buys you |
|---|---|
| `function f<T>(x: T): T` | Return type stays tied to whatever was passed in |
| `<T extends U>` | Restricts `T` to shapes compatible with `U` |
| `<K extends keyof T>` | `K` can only be an actual property name of `T` |
| `T[K]` | The type of a specific property, resolved generically |
| `<T = Default>` | A sensible fallback when the caller doesn't specify `T` |

## A rule of thumb

If you find yourself writing a type parameter that's only ever used once, in one place, it's usually not doing anything — a concrete type would read just as well. Generics earn their keep when the same type variable shows up in at least two places (an input and an output, two inputs that need to match, and so on), which is exactly where they let the compiler catch the mismatches you'd otherwise only find at runtime.
