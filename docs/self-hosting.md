# Self-hosting

The production container runs the same application on your own machine or a server you control. Web
and PostgreSQL ports bind to loopback; a remote browser connects through an SSH tunnel. The
application has no accounts and its mutation endpoints accept only localhost origins, so it is meant
for a single person on a trusted machine, not for exposure on the public internet.

## Build and run locally

The Dockerfile pins Node 24.12.0 by image digest, uses pnpm 11.10.0 and the frozen lockfile, and
packages Next's standalone server plus the data worker's production dependencies. Runtime processes
use the unprivileged `node` user and a read-only filesystem. Imported records and image assets live
in PostgreSQL; uploaded CSVs live in a separate shared imports volume. The web container does not
receive the PandaScore token.

Preserve an existing `.env`. For a new checkout, copy `.env.example` once and set mode 0600. On a
fresh server, set a new `POSTGRES_PASSWORD` and matching `DATABASE_URL` and `CONTAINER_DATABASE_URL`
values there; percent-encode special characters in URL passwords. The host URL uses loopback port
55442, while the container URL uses `postgres:5432`. Changing environment values does not rotate the
password on an already initialized PostgreSQL volume.

```sh
docker compose -f compose.yaml -f compose.app.yaml build
docker compose -f compose.yaml -f compose.app.yaml up --no-build -d --wait
curl --fail http://127.0.0.1:3000/api/health
```

Migrations must succeed before web and worker start. The health endpoint checks the connection and
initialized read model without fetching providers. The worker uses the coordinated queue, retries,
and shared request ceiling. It has five minutes to finish its current job after a stop signal;
interrupted jobs recover through their lease. Application logs rotate at three 10 MiB files per
service.

```sh
docker compose -f compose.yaml -f compose.app.yaml logs --tail 50 web worker
docker compose -f compose.yaml -f compose.app.yaml stop
```

Stopping retains both volumes. Do not use `down -v` for a populated library.

## Imports and current-year updates

Upload annual CSVs through **Sources & imports**. Web and worker mount the same directory at the
same absolute path, so queued uploads remain readable after either container restarts. Setting
`CONTAINER_ORACLE_CURRENT_FILE=/app/.local/imports/2026.csv` makes daily current-year refreshes read
that saved file. It does not download newer contents into the file.

To retain a local file under a stable name, write it as the container user and queue its import:

```sh
docker compose -f compose.yaml -f compose.app.yaml exec -T worker \
  sh -c 'umask 077; cat > /app/.local/imports/2026.csv' < /absolute/path/2026.csv
docker compose -f compose.yaml -f compose.app.yaml exec -T worker \
  node worker/dist/cli.js import 2026 /app/.local/imports/2026.csv
```

The same CLI supports `status`, `resolve`, `entity-history YEAR`, and `entity-rosters YEAR`.
Credentials belong in ignored environment configuration. CSVs, database files, credentials, and
cached source images are excluded from the container build context.

## Backup and restore

A PostgreSQL custom-format dump includes games, source identifiers, image originals and renditions,
roster evidence, migrations, and queue state. Keep the original annual CSVs too: queued file imports
refer to their absolute paths in the imports volume.

```sh
umask 077
mkdir -p .local/backups
docker compose exec -T postgres pg_dump -U esportsviewer -d esportsviewer \
  --format=custom --no-owner --no-acl > .local/backups/library.dump
```

Choose a new filename for each backup and keep a copy on storage separate from the server. Restore
into a **fresh, empty application database** before starting migration/web/worker services:

```sh
docker compose up -d --wait postgres
docker compose exec -T postgres pg_restore -U esportsviewer -d esportsviewer \
  --single-transaction --exit-on-error --no-owner --no-acl < .local/backups/library.dump
docker compose -f compose.yaml -f compose.app.yaml up --no-build -d --wait
```

These commands do not drop existing tables. Rehearse restoration into a separate empty database
before relying on a backup. Confirm history counts and readable images through the query interface,
then check health and browsing. Restore the imports volume or requeue files whose old paths are no
longer available.

## Remote access and updates

On a remote server, use the same loopback-bound stack. Connect from your own machine with
`ssh -N -L 3000:127.0.0.1:3000 user@server`, then browse `http://127.0.0.1:3000`. Serving the
application on a public domain would need an access-control layer in front of it, which this project
does not provide.

For updates, run `pnpm verify` and `pnpm browser:test`, take a backup, build the replacement image,
and run the Compose startup command again. Migrations are transactional and checksum-checked. Keep
the previous image and backup; check migration compatibility before reverting an image.

Packaging references:
[Next standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) and
[pnpm deploy](https://pnpm.io/11.x/cli/deploy).
