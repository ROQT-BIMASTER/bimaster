# Security RLS E2E Tests

End-to-end tests that validate Row-Level Security on tables containing sensitive
financial / competitive / metrics data. Run automatically by the
`security-rls-e2e` GitHub workflow on every push to `main` and every pull request.

## Scripts

### `e2e-anonymous-sensitive-columns.sh`
Probes `our_products`, `product_comparisons`, `social_media_metrics_history`
**without authentication** using every known sensitive column variant
(cost, custo, margin, margem, price, preco, followers, engagement, similarity,
etc.) across `select`, projection, `order` and filter (`gt.0`).

Pass criteria per probe: PostgREST error OR empty JSON array. Any non-empty
array is a data leak and exits 1.

Run locally:
```bash
bash scripts/security/e2e-anonymous-sensitive-columns.sh
```

### `e2e-authenticated-sensitive-columns.sh`
Counterpart that signs in via GoTrue with `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`
and confirms the same endpoints return HTTP 200 + JSON array (RLS evaluated,
not blocked at the role layer). Also re-checks anonymous to guarantee the
lockdown still applies.

If `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` are not set, the script exits 0 with
a SKIP message — useful for forks/PRs that lack secret access.

Run locally:
```bash
E2E_TEST_EMAIL=qa@example.com E2E_TEST_PASSWORD='...' \
  bash scripts/security/e2e-authenticated-sensitive-columns.sh
```

## Required GitHub Secrets (CI)

| Secret              | Purpose                                                |
|---------------------|--------------------------------------------------------|
| `SUPABASE_URL`      | Optional override of default project URL               |
| `SUPABASE_ANON_KEY` | Optional override of default anon key                  |
| `E2E_TEST_EMAIL`    | Seeded test user email (any non-admin role works)      |
| `E2E_TEST_PASSWORD` | That user's password                                   |

Configure under **Repository → Settings → Secrets and variables → Actions**.

## Adding new sensitive tables

1. Add the table + sensitive column variants to the arrays at the top of
   `e2e-anonymous-sensitive-columns.sh`.
2. Add a probe entry to the `PROBES` array in
   `e2e-authenticated-sensitive-columns.sh` using the **real** column names.
3. Push — CI will validate both.
