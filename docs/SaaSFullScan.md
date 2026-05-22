# SaaS Application — Full Security & Quality Audit Prompt
---

You are performing a comprehensive security and quality audit of a SaaS application that runs on both **web** and **mobile** (iOS & Android). Your job is to systematically examine every area listed below.

For **every issue you find**, provide:
1. **Location** — file name, function, line number if possible
2. **Risk** — what can go wrong, who is affected, severity (Critical / High / Medium / Low)
3. **Fix** — working code example demonstrating the correct implementation
4. **Priority** — order in which fixes should be applied

Do not skip sections. If a section looks clean, say so explicitly. Do not summarize vaguely — be specific.

---

## 1. INPUT/OUTPUT SECURITY

### 1.1 Injection Attacks
- **SQL Injection** — verify every database query uses parameterized statements or a safe ORM. Never interpolate user input into SQL strings. Test with: `' OR 1=1--`, `'; DROP TABLE users--`
- **NoSQL Injection** — for MongoDB/Firebase, ensure all objects sent to the DB are sanitized. Test with: `{"$gt": ""}` in email/password fields
- **Command Injection** — search for any use of `exec`, `shell_exec`, `spawn`, `system` with user-supplied input. There must be none.
- **Template Injection (SSTI)** — test all text fields with `{{7*7}}` and `${7*7}`. Check Jinja2, Handlebars, Pug, Mustache templates.
- **Path Traversal** — any file path derived from user input must be validated and normalized. Test with: `../../etc/passwd`
- **SSRF (Server-Side Request Forgery)** — any `fetch`/`curl` call using a user-supplied URL must whitelist allowed domains. Test with: `http://169.254.169.254/latest/meta-data/`, `http://localhost/admin`
- **XXE (XML External Entity)** — if XML is parsed anywhere, confirm external entity processing is disabled in the parser config
- **Open Redirect** — `redirect=` and `url=` query parameters must only allow whitelisted domains. Test with: `?redirect=https://evil.com`

### 1.2 Cross-Site Scripting (XSS)
- **Stored XSS** — all content retrieved from the database and rendered in HTML must be HTML-escaped. Test by saving `<script>alert(1)</script>` in every text field.
- **Reflected XSS** — all URL parameters rendered in the page must be escaped. Test every query param.
- **DOM XSS** — search for dangerous sinks: `innerHTML`, `document.write`, `eval`, `dangerouslySetInnerHTML`. Every usage must be reviewed.

---

## 2. HTTP SECURITY HEADERS & BROWSER PROTECTIONS

Check that every HTTP response includes the following headers. Flag any that are missing or misconfigured.

| Header | Required Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'` — no `unsafe-inline`, no `unsafe-eval` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | restrict camera, microphone, geolocation to minimum needed |
| `Access-Control-Allow-Origin` | never `*` on authenticated endpoints |

- **CSRF Protection** — every state-changing request (POST, PUT, PATCH, DELETE) must include a CSRF token validated server-side. This applies to both web forms and API calls from mobile.
- **SameSite Cookies** — all session cookies must have `SameSite=Strict` or `SameSite=Lax`.
- **Subresource Integrity (SRI)** — all third-party scripts loaded from CDN must have `integrity="sha256-..."` attributes.
- **CORS** — verify the allowed origins list. No wildcard on credentialed endpoints. Test with a request from an unexpected origin.
- **Server header** — must not expose software name or version (e.g. `Server: Apache/2.4.51` must be hidden).

---

## 3. ENCRYPTION & DATA STORAGE

- **TLS version** — only TLS 1.2 and 1.3 must be accepted. Disable SSLv3, TLS 1.0, TLS 1.1. Verify cipher suites (no RC4, no DES). Target A grade on SSL Labs.
- **Password hashing** — passwords must be hashed with `bcrypt`, `Argon2id`, or `scrypt`. Never `md5`, `sha1`, or `sha256` for passwords. Verify salt is unique per user.
- **Encryption at rest** — PII, payment data, health data, and any regulated fields must be encrypted in the database, not stored as plain text.
- **HTTP → HTTPS redirect** — all HTTP requests must 301-redirect to HTTPS, including API calls from mobile clients.
- **HttpOnly + Secure cookies** — session tokens in cookies must have both `HttpOnly=true` and `Secure=true`. Verify in DevTools → Application → Cookies.
- **No secrets in localStorage** — JWT tokens, passwords, and PII must not be stored in `localStorage` or `sessionStorage`. Use `httpOnly` cookies or secure in-memory storage.
- **No secrets in frontend bundle** — scan the compiled JS bundle for: `API_KEY`, `SECRET`, `PASSWORD`, `PRIVATE_KEY`. None should appear.
- **No secrets in git** — check `.env` files are in `.gitignore`. Scan git history for accidentally committed credentials.
- **Exposed files** — test direct access to: `/.git/config`, `/.env`, `/config.json`, `/web.config`, `/.DS_Store`, `/phpinfo.php`. All must return 403 or 404.

---

## 4. AUTHENTICATION

- **Brute force protection** — after 5–10 failed login attempts, the account must be rate-limited or temporarily locked. Test by sending 20 rapid failed logins. Check both IP-based and account-based throttling.
- **Account enumeration** — the response to "email not found" and "wrong password" must be identical in text, timing, and HTTP status. Different messages allow attacker to enumerate valid emails.
- **Password reset token** — must be: cryptographically random (UUID v4 minimum), single-use (invalidated immediately after use), short-lived (max 15–60 minutes). The link must be sent only to the registered email.
- **Session fixation** — after successful login, the session ID must be rotated. A session ID obtained before login must not remain valid afterward.
- **Logout invalidates server-side session** — after logout, the old session token/JWT must be rejected by the server (not just cleared on the client). Test by capturing the token before logout and replaying it after.
- **"Remember Me" token** — if implemented, the token must be: long and random (32+ bytes), stored hashed in DB, rotated on each use, expired after a reasonable period (e.g. 30 days).
- **OAuth/SSO** — verify the `state` parameter is present and validated (prevents CSRF on the OAuth flow). For mobile, verify PKCE is implemented. Confirm redirect URIs are strictly whitelisted.
- **MFA/2FA** — verify that 2FA cannot be bypassed by manipulating the login flow (e.g. skipping the second step by going directly to an authenticated URL after step one).

---

## 5. AUTHORIZATION & ACCESS CONTROL

- **BOLA / IDOR (Broken Object Level Authorization)** — for every endpoint that accepts a resource ID, verify the server checks that the authenticated user owns that resource. Example: `GET /api/orders/123` — does the server verify order 123 belongs to the current user?
- **Function-level authorization** — attempt to call admin-only endpoints as a regular user: `POST /api/admin/users`, `DELETE /api/users/:id`, `GET /api/reports`. Each must return 403.
- **RBAC consistency** — authorization must be enforced at the API layer, not just hidden in the UI. Hiding a button is not a security measure.
- **Mass assignment** — test sending unexpected fields in request bodies: `{"role": "admin"}`, `{"is_verified": true}`, `{"subscription_tier": "enterprise"}`. The server must ignore fields it did not explicitly whitelist.
- **JWT validation** — verify: signature is validated with the correct secret/key; `alg: none` is rejected; expired tokens (`exp` claim) are rejected; tokens signed with a different algorithm than expected are rejected. Use jwt.io to manually forge a token and confirm it is rejected.
- **Least privilege** — database user must have only the permissions it needs (no superuser). Cloud service accounts must follow least privilege. Review all IAM roles.
- **API keys** — must be long (32+ random characters), stored hashed in DB, never logged in plain text, and rotatable without service disruption.

---

## 6. BUSINESS LOGIC

### 6.1 Payments & Transactions
- **Server-side pricing** — the final price charged must come from the server/database, never from the client request body. Test by sending `{"price": 0.01}` in the checkout payload.
- **Negative values** — test all numeric inputs with: `0`, `-1`, `-999`, `99999999`. What happens to the balance, inventory, or cart?
- **Race condition on payment** — send two identical checkout requests simultaneously. Is the user charged twice? Implement idempotency keys.
- **Coupon code abuse** — test: reusing a single-use code, applying a code to an ineligible product, using an expired code, using someone else's personal code.
- **Refund abuse** — verify: cannot refund more than original charge, cannot refund an already-refunded order, cannot refund an order that was not paid.
- **Free tier limits** — verify that free-tier limits cannot be bypassed by rapid requests, header manipulation, or account deletion + re-creation.

### 6.2 State Machines & Data Integrity
- **State machine integrity** — verify no workflow state can be skipped. Example: an order cannot jump from `pending` to `completed` without passing through `approved`.
- **Race conditions on shared data** — two users updating the same record simultaneously must not corrupt data. Verify optimistic locking, pessimistic locking, or atomic DB operations.
- **Cross-service data consistency** — if payment succeeds but the DB write fails, what happens? There must be compensation logic, retry, or transactional outbox pattern.
- **Concurrent inventory** — two users buying the last item in stock simultaneously must not both succeed. Verify atomic `UPDATE inventory SET quantity = quantity - 1 WHERE quantity > 0`.
- **Delete cascades** — deleting a user or record must not leave orphaned data. Verify foreign key constraints and cascading deletes are correct.
- **Multi-tenancy isolation** — every database query that returns tenant-scoped data must include a `tenant_id` filter. Test by modifying tenant_id in the request.
- **Timezone handling** — test date/time logic around: midnight boundaries, DST transitions, users in different timezones.

---

## 7. DATABASE

- **Missing indexes** — run `EXPLAIN` / `EXPLAIN ANALYZE` on the 10 most frequent queries. Flag any sequential scans (`Seq Scan`) on large tables. Add the missing indexes.
- **N+1 query problem** — loading a list of 100 items must not generate 101 queries. Verify eager loading / JOINs are used. Check the query log under load.
- **Transactions** — every operation that involves two or more database writes must be wrapped in a transaction. Verify no partial writes can occur.
- **Connection pooling** — verify a connection pool (PgBouncer, HikariCP, etc.) is in place. The application must not open a new DB connection per request.
- **Query timeouts** — set `statement_timeout` (PostgreSQL) or equivalent. No query should be allowed to run indefinitely.
- **Soft delete filter** — if soft delete is used (`deleted_at` column), verify that every query that should exclude deleted records has the filter. Check for any query that might accidentally return deleted records.
- **Migration safety** — every migration must have a rollback path (`down()` method). Migrations should be run inside a transaction where possible. No migration should lock a production table for more than a few seconds.
- **Backup & recovery** — verify automated backups are configured. Verify point-in-time recovery is available. Perform an actual restore test in a staging environment.
- **Sensitive data in logs** — verify that database query logs do not contain passwords, credit card numbers, or PII in plain text.

---

## 8. API DESIGN & RESILIENCE

### 8.1 Input & Design
- **Input validation on every endpoint** — every field must be validated for: type, required/optional, min/max length, format (email, UUID, date). Send missing fields, wrong types, and extremely long strings.
- **Rate limiting** — verify rate limits on: `/login`, `/register`, `/forgot-password`, all public API endpoints. What is the key (IP, user ID, API key)? What are the limits? What happens when exceeded?
- **Pagination** — every endpoint returning a list must support pagination. Test `limit=999999`. No endpoint should return an unbounded result set.
- **Idempotency** — POST endpoints that create resources must support an `Idempotency-Key` header. Sending the same request twice must not create two records.
- **Consistent error format** — every error response must return: correct HTTP status code, structured JSON body with `error` field, no stack trace or internal detail.
- **Webhook validation** — every incoming webhook must be validated by verifying an HMAC signature (e.g. Stripe's `Stripe-Signature` header). Reject any webhook without a valid signature.
- **GraphQL protection** — if GraphQL is used: enforce query depth limit (max 5–7), query complexity limit, and disable introspection in production.

### 8.2 Fault Tolerance
- **Timeouts on all outbound HTTP calls** — every call to an external service (Stripe, SendGrid, S3, etc.) must have a timeout. No open-ended requests.
- **Graceful degradation** — what happens when Stripe is down? When the email service is unavailable? When S3 is unreachable? There must be a fallback, a clear error to the user, and no crash.
- **Circuit breaker** — implement circuit breaker pattern for calls to external services. Stop hammering a failing dependency.
- **Retry with exponential backoff** — retries must use exponential backoff with jitter, not fixed intervals.
- **Uncaught exception handler** — verify `uncaughtException` and `unhandledRejection` (Node.js) or equivalent are handled globally. An unhandled error must not crash the process.
- **Health check endpoint** — verify `/health` or `/healthz` exists, checks DB connectivity, cache, and queue, and returns 200 only when all are healthy.

---

## 9. PERFORMANCE

### 9.1 Frontend
- **Time to Interactive (TTI)** — must be under 3 seconds on a mid-range device on a 4G connection. Measure with Lighthouse. If over, investigate: render-blocking resources, large bundle, no code splitting.
- **Core Web Vitals** — LCP < 2.5s, CLS < 0.1, INP < 200ms. Measure with PageSpeed Insights.
- **Button click feedback** — every interactive element must provide visual feedback (spinner, disabled state, color change) within 100ms of a click, even if the network call takes longer.
- **Code splitting & lazy loading** — each route/page should load only its own JavaScript chunk. Verify with webpack-bundle-analyzer or Vite's rollup visualizer.
- **Image optimization** — images must use WebP or AVIF format, have correct `srcset` for responsive sizes, and use `loading="lazy"` for below-the-fold images.
- **Static asset caching** — JS/CSS files must be served with long-lived `Cache-Control: max-age=31536000, immutable` (with content-hash in filename). HTML: `no-cache`.
- **Memory leaks in SPA** — on component unmount, verify all event listeners, intervals, timers, and subscriptions are cleaned up.

### 9.2 Backend
- **API P95 latency** — 95th percentile response time must be under 500ms. Endpoints over this threshold must be investigated.
- **Cache invalidation** — after any update, verify the cache is invalidated correctly. Stale data being displayed is a critical business logic issue, not just a performance issue.
- **Background jobs for long operations** — email sending, PDF generation, report building, image processing must happen in a queue (BullMQ, Sidekiq, Celery), not during an HTTP request.
- **CDN for static assets** — images and static files must be served from a CDN, not the application server directly.
- **Compression** — all text-based responses (HTML, JSON, CSS, JS) must be served with `Content-Encoding: gzip` or `br`.
- **Stateless services** — application servers must hold no local state. Sessions must live in Redis. Uploaded files must go to S3 or equivalent. Verify horizontal scaling works.

---

## 10. MOBILE — iOS & ANDROID

### 10.1 Security
- **Certificate pinning** — the app must validate the server's certificate against a pinned certificate or public key. Without this, a MITM attack on the device network is trivial.
- **No sensitive data in device logs** — search for `console.log`, `Log.d`, `NSLog` calls that include tokens, passwords, or PII. Production builds must have all debug logging disabled.
- **Biometric authentication** — biometric verification must result in a server-validated action (e.g. retrieve a key from secure enclave and sign a server challenge). Local-only biometric checks can be bypassed on rooted/jailbroken devices.
- **Deep link validation** — all deep link / universal link handlers must validate the incoming URL and parameters before acting on them. Do not trust the URL blindly.
- **Screenshot prevention** — screens displaying sensitive information (balances, PII, payment details) must use `FLAG_SECURE` (Android) or blur the snapshot (iOS backgrounding).
- **Jailbreak / root detection** — consider detecting jailbroken or rooted devices and limiting functionality for high-risk operations (payments, admin actions).

### 10.2 Reliability & UX
- **Offline/sync conflict resolution** — if the app allows offline edits, define and implement a conflict resolution strategy. Test: edit offline → come online → server also changed → what happens?
- **API version compatibility** — users on old app versions must receive a clear "please update" message, not a crash or silent failure, when they hit a deprecated API endpoint.
- **Network retry on flaky connections** — all API calls must handle timeout + retry gracefully, especially during WiFi-to-cellular transitions.
- **Push notification token lifecycle** — tokens must be refreshed on app launch, updated in the database, and old/invalid tokens must be pruned.
- **Minimal permissions** — request only the permissions strictly needed. Request at the moment of use, not on app launch. Explain to the user why each permission is needed.

---

## 11. INFRASTRUCTURE & DEVOPS

- **Secrets management** — no secrets in source code, `.env` files committed to git, or environment variables logged. Use AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, or equivalent.
- **Centralized logging** — all services must log to a centralized system (Datadog, Splunk, ELK). Every log entry must include a correlation/trace ID for end-to-end request tracing.
- **Monitoring & alerting** — alerts must fire on: error rate > 1%, P95 latency > 1s, memory usage > 80%, disk usage > 85%, failed background jobs.
- **Auto-scaling** — verify that the system can scale horizontally under load. Run a load test at 10× normal traffic and confirm behavior.
- **Disaster recovery** — define and document RTO (Recovery Time Objective) and RPO (Recovery Point Objective). Maintain a runbook. Run a recovery drill at least annually.
- **Dependency vulnerability scanning** — use Dependabot, Snyk, or similar. All dependencies must be free of known critical CVEs. Run `npm audit` / `pip audit` / `bundle audit` in CI.
- **Container security** — Docker images must: be scanned (Trivy, Grype), run as a non-root user, use minimal base images (distroless or Alpine), have no critical CVEs.
- **Network segmentation** — the database must not be publicly accessible. Only application servers should be allowed to reach the DB (via security group / firewall rules). Verify this is enforced.
- **CI/CD security gates** — SAST scanning (Semgrep, SonarQube) must run on every pull request. Builds with critical findings must be blocked from merging.
- **WAF (Web Application Firewall)** — a WAF (Cloudflare, AWS WAF, etc.) must sit in front of the application and block common attack patterns: SQLi, XSS, bot traffic, DDoS.
- **Directory listing disabled** — verify that browsing to `/uploads/`, `/static/`, `/files/` returns 403, not a directory listing.

---

## Severity Reference

| Level | Meaning | Example |
|---|---|---|
| **Critical** | Exploitable right now, data breach or financial loss likely | SQL Injection, IDOR, payment manipulation |
| **High** | Significant risk, exploitable with moderate effort | Missing rate limiting, JWT alg:none, missing CSRF |
| **Medium** | Real risk, lower immediate impact | Missing security headers, N+1 queries, missing index |
| **Low** | Best practice violation, low direct risk | Missing SRI, verbose server header, FOIT |

---

*Audit checklist — Web + Mobile SaaS — covers: Injection, XSS, CSRF, Authentication, Authorization, Business Logic, Database, API Design, Performance, Mobile Security, Infrastructure*