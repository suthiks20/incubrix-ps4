# Lemmy and Ghost local-instance spike

This is an isolated Docker Compose spike. It does not change the application, its source, or its tests.
Credentials are written only to gitignored `spike/out.json`; bootstrap and verification never print them.

## Images, limits, and endpoints

| Service | Exact image | Host endpoint | Memory limit |
| --- | --- | --- | --- |
| Lemmy | `dessalines/lemmy:0.19.12` | `http://localhost:8536` | 512 MiB |
| Lemmy database | `postgres:16.10-alpine` | internal only | 512 MiB |
| pict-rs | `asonix/pictrs:0.5.19` | internal only | 256 MiB |
| Ghost | `ghost:6.0.10-alpine` | `http://localhost:2368` | 1 GiB |

Ghost uses its supported local-development SQLite configuration: `NODE_ENV=development`,
`database__client=sqlite3`, and `database__connection__filename=/var/lib/ghost/content/data/ghost.db`.
There is no MySQL service or image in this Compose file.

The measured time from `up -d`/service start to the Compose healthcheck reporting ready was 12.7 seconds for
Lemmy and 13.6 seconds for Ghost. The first Lemmy healthcheck used `wget`, which is absent in the image;
the working final probe uses its installed `curl`. Ghost's final Node `fetch` probe has a 15-second timeout
because the first `GET /` took 4.865 seconds while Ghost completed its initial setup.

`docker stats --no-stream` after both API checks reported:

```text
spike-ghost-1     157.3MiB / 1GiB       15.36%
spike-lemmy-1      88.45MiB / 512MiB    17.28%
spike-lemmy-db-1   59.55MiB / 512MiB    11.63%
spike-pictrs-1     27.53MiB / 256MiB    10.75%
```

## Lemmy API proof

The script uses the initial administrator declared in `lemmy.hjson`. It performs one
`POST /api/v3/user/login`, persists the returned `jwt`, and thereafter sends
`Authorization: Bearer <jwt>`. This avoids Lemmy 0.19's `login_token` primary-key collision when two
logins happen in the same second.

The literal API community name `incubrix-test` returned `400 {"error":"invalid_name"}`. Lemmy permits an
underscore in the machine-readable community name, so the idempotent bootstrap creates/reads
`incubrix_test` with the requested visible title `incubrix-test`. This is the only naming deviation.

| Operation | Endpoint | Request fields | Observed response fields |
| --- | --- | --- | --- |
| Login | `POST /api/v3/user/login` | `username_or_email`, `password` | `jwt` |
| Read/create community | `GET` / `POST /api/v3/community` | `name`; then `name`, `title`, `description` | `community_view.community.id` |
| Create post | `POST /api/v3/post` | `community_id`, `name`, `body` | `post_view.post.id` |
| Read post | `GET /api/v3/post?id=<id>` | `id` | `post_view.post.body`, `post_view.post.deleted` |
| Soft delete | `POST /api/v3/post/delete` | `post_id`, `deleted: true` | HTTP 200 |

Real final verification output:

```json
{"lemmy":{"post_id":4,"read_body":"Lemmy local verification ix-spike-1792735228711","delete_status":200,"gone_field":"post_view.post.deleted","gone_value":true}}
```

Thus Lemmy's proof of “gone” is `post_view.post.deleted === true`; deletion is soft.

## Ghost API proof

Bootstrap first checks `GET /ghost/api/admin/authentication/setup/`, whose response uses
`setup[0].status`. If setup is needed it sends `POST /ghost/api/admin/authentication/setup/` with
`setup[0].name`, `email`, `password`, and `blogTitle`; a local-only, high-entropy password is required by
Ghost. It then signs in with `POST /ghost/api/admin/session/`, retaining the `Set-Cookie` response header
and supplying `Origin: http://127.0.0.1:2368`.

The custom integration is created with `POST /ghost/api/admin/integrations/` and the body
`integrations: [{name: "incubrix", description: "Local API spike"}]`. The response exposes
`integrations[0].api_keys`; the `type: "admin"` record supplies its `secret`, saved as the `id:secret`
Admin API key in `spike/out.json`. A repeated bootstrap sees that saved key and makes no new session or
integration, which avoids Ghost's configured-email requirement for repeated password sessions.

The verification script builds a JWT with Node `crypto` alone. Its header is
`{alg:"HS256",typ:"JWT",kid:<id>}`, its payload contains `iat`, `exp` (five minutes later), and
`aud:"/admin/"`; the HMAC-SHA256 key is `Buffer.from(<hex secret>, "hex")`. Calls send
`Authorization: Ghost <jwt>` and `Accept-Version: v6.0`.

| Operation | Endpoint | Request fields | Observed response fields |
| --- | --- | --- | --- |
| Setup status | `GET /ghost/api/admin/authentication/setup/` | `Origin` | `setup[0].status` |
| Owner setup | `POST /ghost/api/admin/authentication/setup/` | `setup[0].name`, `email`, `password`, `blogTitle` | HTTP 201 |
| Session | `POST /ghost/api/admin/session/` | `username`, `password`, `Origin` | `Set-Cookie` |
| Integration | `GET` / `POST /ghost/api/admin/integrations/` | `integrations[0].name`, `description` | `integrations[0].api_keys` |
| Create post | `POST /ghost/api/admin/posts/?source=html` | `posts[0].title`, `slug`, `html`, `status` | `posts[0].id`, `posts[0].slug` |
| Read post | `GET /ghost/api/admin/posts/<id>/?formats=html` | `id` | `posts[0].slug` |
| Delete/read after delete | `DELETE`, then `GET /ghost/api/admin/posts/<id>/` | `id` | HTTP 204, then HTTP 404 |

Real final verification output:

```json
{"ghost":{"post_id":"6adaf7fdcc69d2000108bbb7","read_slug":"ix-spike-1792735229113","delete_status":204,"gone_status":404}}
```

Ghost's proof of “gone” is the subsequent `GET` returning HTTP 404, rather than a soft-delete field.

## Clean-state procedure and results

The clean-state command run was:

```text
docker compose -f spike/docker-compose.yml down -v --remove-orphans
docker compose -f spike/docker-compose.yml up -d lemmy-db pictrs lemmy
docker compose -f spike/docker-compose.yml up -d ghost
```

`node spike/bootstrap.js lemmy` and `node spike/bootstrap.js ghost` were each run twice successfully after
the final idempotency changes. `node spike/verify.js lemmy` created, read, and soft-deleted a marker post;
`node spike/verify.js ghost` created, read, and permanently deleted a marker-slugged draft.

No image pull stalled: all four exact images were verified locally before startup. The initial Ghost setup
attempt rejected two memorable local passwords with HTTP 422 as insecure; the final random local-only value
passed validation. Earlier repeated Ghost sessions failed with HTTP 500 because no mail transport exists;
the final bootstrap safely reuses its stored Admin API key and does not initiate a duplicate session.

No manual browser step was required. The only non-automatable semantic detail is the Lemmy API handle rule:
the requested hyphenated handle is invalid, so the underscore API handle and hyphenated display title are used.
