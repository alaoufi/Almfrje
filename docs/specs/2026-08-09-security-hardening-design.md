# Security hardening: phase one

## Scope

This change hardens the live application's legacy API authentication, response
security headers, and vulnerable production dependencies. It does not change
the public product flows, Supabase schema, or stored data.

## Authentication

The legacy consultation API must use a `JWT_SECRET` environment variable of at
least 32 characters. There is no hard-coded or compatibility fallback. When it
is missing or weak, token generation and verification fail closed and callers
receive an authentication failure instead of gaining access.

Existing deployment operators must generate a new random secret, set it in the
production environment, and redeploy. This intentionally invalidates tokens
signed with the old insecure value.

## HTTP headers

The Next.js configuration applies baseline browser protections to every route:

- a restrictive Content Security Policy compatible with this static,
  same-origin application and Supabase connections;
- frame embedding restricted to the same origin;
- `nosniff`, strict referrer policy, and a minimal permissions policy.

API and Supabase proxy routes retain their existing cache policy. No CORS policy
is widened.

## Dependencies and verification

The lockfile is refreshed to a patched, compatible Next.js release. Regression
tests prove that a missing or weak JWT secret cannot create or accept a token,
and that a strong environment secret can round-trip a token. The final checks
are the focused test, project boundary check, production build, and dependency
audit.

## Non-goals

- Changing Supabase RLS or storage bucket visibility.
- Migrating the legacy API to Supabase Auth.
- Adding a new deployment platform or modifying production environment values.
