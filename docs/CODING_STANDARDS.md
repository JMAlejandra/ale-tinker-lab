# Coding Standards

This document describes how code in this project is organized and written. It's read by both human reviewers and AI code-review tooling — when a diff doesn't follow a rule here, that's a real finding, not a style nitpick. Anything not covered here falls back to general judgment (readability, avoiding duplication, clear naming).

Stack assumed: Next.js (App Router), tRPC, Drizzle ORM, PostgreSQL, TypeScript, Zod.

---

## 1. Project structure

### 1.1 Business-logic modules

Business logic lives in self-contained modules, independent of tRPC and Next.js. tRPC routers and Route Handlers are **orchestrators only** — they parse/authenticate input and call into a module's service layer. No business logic lives in a router procedure or a route handler.

```
my-module/
  index.ts                      # public barrel — the ONLY entry point other code may import
  my-module.types.ts            # domain types
  my-module.errors.ts           # custom error classes for this module
  my-module.validators.ts       # Zod schemas for input/output validation
  my-module.utils.ts            # pure helper functions, internal to the module
  my-module.repository.ts       # data access (Drizzle queries)
  my-module.service.ts          # business rules; calls the repository
  __tests__/
    my-module.test.ts
    my-module.repository.test.ts
```

Rules:

- **`index.ts` is a real barrel, not a dumping ground.** It re-exports only what other modules/routers are allowed to use:
  ```ts
  export { createInvoice, cancelInvoice } from "./my-module.service";
  export type { Invoice, InvoiceStatus } from "./my-module.types";
  export { InvoiceNotFoundError } from "./my-module.errors";
  ```
  `repository.ts` and internal helpers in `utils.ts` are never re-exported from `index.ts` — this keeps the module's internals swappable.
- **`validators.ts`** holds Zod schemas used for input/output validation (tRPC procedure inputs, etc.). Do not call this file `schema.ts` — that name is reserved for Drizzle table schemas (`server/db/schema/*`) to avoid ambiguity between "validation schema" and "DB schema."
- **`repository.ts`** is the only file allowed to import Drizzle/DB clients directly. Nothing outside the module talks to the database directly.
- **`service.ts`** contains the actual business rules and orchestration; it calls `repository.ts` and is what `index.ts` exposes.
- Trivial CRUD with no real logic may skip the service layer and query Drizzle directly from the router — don't force ceremony onto a plain "get by id." (See §4 for what warrants a test — the same "trivial vs. not" judgment applies here.)
- One test file per source file that has meaningful logic; colocate all tests for the module under `__tests__/`.
- Naming: every file in a module is prefixed with the module name (`my-module.*.ts`) for greppability.

### 1.2 Components folder

Split along two axes: **shared vs. route-specific**, and within shared, **primitive/UI vs. composed/domain**.

```
components/
  ui/                            # generic, app-agnostic primitives (shadcn/ui output)
    button.tsx
    input.tsx
  shared/                        # composed components reused across 2+ features
    date-range-picker/
      date-range-picker.tsx
      date-range-picker.test.tsx
  <feature>/                     # components used by exactly one feature (if not colocated in app/)
    invoice-table.tsx
    invoice-status-badge.tsx
```

Rules:

- **`ui/`**: generic primitives only. Nothing domain-aware (no `InvoiceButton`). If using shadcn/ui, this is its default output location — don't restructure it.
- **`shared/`**: components used by 2+ features but not a raw primitive (e.g. `<Money />`, `<ConfirmDialog />`).
- **Feature-specific components**: either `components/<feature>/`, or colocated under `app/**/_components/` next to the route that owns them (App Router). Pick one convention per project and don't mix the two — mixing is the most common source of "where does this go" friction.
- One component per file; filename matches the export.
- Named exports only, except for Next.js special files (`page.tsx`, `layout.tsx`, etc.) which require default exports.

### 1.3 Next.js routing (App Router)

Use the App Router (Pages Router is legacy at this point; T3's scaffold defaults to App Router).

```
app/
  (marketing)/                   # route group — no URL segment, isolates layout
    page.tsx
  (dashboard)/
    layout.tsx
    invoices/
      page.tsx
      loading.tsx
      _components/               # underscore = opts folder out of routing; private to this route
        invoice-list.tsx
  api/
    trpc/[trpc]/route.ts         # T3's single tRPC HTTP handler — do not restructure
```

Rules:

- Route groups `(name)` apply layouts without affecting the URL.
- `_folder` (underscore prefix) opts a folder out of Next's routing — use for route-local components/helpers instead of a separate top-level `components/<feature>/` folder, when tight colocation is preferred.

### 1.4 API endpoints: internal vs. external

Internal and external API traffic use different transports — never mix them on the same path.

```
app/api/
  trpc/[trpc]/route.ts           # tRPC handler — internal use only
  webhooks/
    stripe/route.ts              # external caller (webhook)
  v1/
    invoices/route.ts            # external-facing REST-ish endpoint, if exposed
```

Rules:

- **Internal calls** (from the app's own React tree): tRPC only, via the generated hooks/client. Never call `/api/trpc/...` manually from the frontend.
- **External callers** (webhooks, third-party integrations, anything without a tRPC client): plain Next.js Route Handlers under `app/api/`, not tRPC. tRPC's batching/superjson serialization and lack of a default OpenAPI contract make it a poor fit for external consumers.
- If external callers need API-key auth, versioning, or OpenAPI docs, generate a REST surface from the existing tRPC routers (e.g. via `trpc-to-openapi`) rather than hand-writing a second implementation of the same business logic.
- **Both transports are thin.** A tRPC procedure and a route handler only: parse/validate input, authenticate, and call the relevant module's `service.ts`. All business logic lives in the module.

---

## 2. Architecture: orchestrators and services

- tRPC procedures (and Route Handlers, per §1.4) are **orchestrators**: validate input via Zod, authenticate, call one or more service functions, shape the response. No business logic and no direct Drizzle queries here beyond the trivial-CRUD exception in §1.1.
- Business logic lives in `*.service.ts` — plain functions, no tRPC or Next.js imports. This keeps services framework-agnostic and independently testable.
- `*.repository.ts` is the only place that talks to Drizzle. Services call the repository; they don't build queries themselves.

---

## 3. Error handling

**The invariant:** every error a user sees rendered with a specific, helpful message came from an explicit `MyAppError` subclass. Everything else gets a generic message. No exceptions, no per-procedure judgment calls.

### 3.1 Defining app errors

```ts
// server/errors/app-errors.ts
export abstract class MyAppError extends Error {
  abstract readonly code: string;
}

export class NotFoundError extends MyAppError {
  readonly code = "NOT_FOUND" as const;
}

export class DuplicateEmailError extends MyAppError {
  readonly code = "DUPLICATE_EMAIL" as const;
  constructor(readonly email: string) {
    super(`Email already in use: ${email}`);
  }
}
```

Naming rules:

- Suffix `Error`, never `Exception`.
- Name after the **business condition**, not the transport status — `DuplicateEmailError`, `InsufficientBalanceError`, not `ConflictError` or `BadRequestError`. Tying the name to a TRPCError code re-couples the two things this pattern exists to separate.
- Every subclass carries a literal `code` string. This — not the class name — is what the client switches on, since class identity doesn't survive JSON serialization across the network boundary.
- Keep the full set of app errors in one file per module (`my-module.errors.ts`, aggregated at `server/errors/app-errors.ts` for cross-cutting ones) so it stays a browsable vocabulary instead of scattered, duplicated near-equivalents.
- Most errors are just `code + message`. Only add extra fields (like `email` above, or `fields` for form validation) when the UI genuinely needs structured data beyond the message — that's the exception, not the norm.

### 3.2 Throwing and translating

- Services throw `MyAppError` subclasses for expected business failures. They never throw or import `TRPCError`.
- The procedure attaches the app error as `cause` on a `TRPCError`:
  ```ts
  throw new TRPCError({ code: "NOT_FOUND", cause: err });
  ```
- A single global `errorFormatter` is the **only** place that unpacks `error.cause` into the response shape:
  ```ts
  // server/trpc.ts
  const t = initTRPC.context<Context>().create({
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          appError: error.cause instanceof MyAppError
            ? { code: error.cause.code, message: error.cause.message }
            : null,
        },
      };
    },
  });
  ```
- Anything that is **not** `instanceof MyAppError` is unexpected: it gets a generic client-facing message, is never enriched, and is always logged server-side with full detail.

### 3.3 Rendering on the client

Switch on `code`, not on class — and use an exhaustive fallback so a new server-side error type that isn't yet handled on the client is a compile error, not a silent generic message:

```ts
switch (appError.code) {
  case "NOT_FOUND": return <NotFoundBanner />;
  case "DUPLICATE_EMAIL": return <DuplicateEmailBanner email={appError.email} />;
  default: {
    const _exhaustive: never = appError;
    return <GenericErrorBanner />;
  }
}
```

---

## 4. Testing

- Test the critical paths and business logic — service functions with real rules, not trivial CRUD passthroughs.
- Vitest for unit/integration, React Testing Library for components, Playwright for e2e.
- Colocate tests under a module's `__tests__/` folder (§1.1).

---

## 5. Naming conventions

| What | Convention | Example |
|---|---|---|
| Files | kebab-case | `invoice-status-badge.tsx` |
| Functions, variables | camelCase | `createInvoice` |
| Types, components | PascalCase | `InvoiceStatus`, `InvoiceTable` |
| Error classes | PascalCase, suffixed `Error`, named after the business condition | `DuplicateEmailError` |
| Error codes | SCREAMING_SNAKE_CASE string literal on the class | `"DUPLICATE_EMAIL"` |

---

## 6. Non-goals

Things this project deliberately does *not* do, so a reviewer doesn't flag them as missing:

- No REST API for internal use — tRPC only (§1.4).
- No business logic in tRPC procedures or Route Handlers, even for "just this once" cases.
- No generic `ConflictError`/`BadRequestError`-style classes — every app error names its actual business condition.
