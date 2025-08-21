# jayz

A tiny Azure REST CLI you can extend straight from Microsoft Learn pages.

## Install

```bash
npm install
```

Run locally (no global install needed):
```bash
./bin/jayz --help
# or
npx -y . --help
```

## Configuration

jayz merges config in this order: CLI flags → env (`JAYZ_*`) → `~/.config/jayz/config.json`

### Interactive setup

Initialize or update your config file interactively:
```bash
./bin/jayz init
# or
npx -y . init
```

What it does:
- Prompts for **clientId**, **tenantId**, and optional **subscriptionId**/**authorityHost**
- Optionally stores a **clientSecret** for `--mode secret` (masked input)
- Backs up any existing config as `config.json.<timestamp>.bak`
- Locks file perms to `0600` on Unix-like systems

### Env vars (`JAYZ_*`)

```bash
export JAYZ_CLIENT_ID=<your_aad_app_client_id>
export JAYZ_TENANT_ID=<your_tenant_id>
# optional:
export JAYZ_SUBSCRIPTION_ID=<default_subscription_id>
# optional (sovereign clouds):
# export JAYZ_AUTHORITY_HOST="https://login.microsoftonline.us"
```

## Login

- **Default (browser OAuth + localhost callback):**
```bash
./bin/jayz login
```

- Device code (terminal-only):
```bash
npm i msal-node
./bin/jayz login --mode device --client-id $JAYZ_CLIENT_ID --tenant-id $JAYZ_TENANT_ID
```

- Client secret (service principal):
```bash
npm i msal-node
./bin/jayz login --mode secret --client-id $JAYZ_CLIENT_ID --client-secret <secret> --tenant-id $JAYZ_TENANT_ID
```

## Generic call

```bash
./bin/jayz call --method GET --url "https://management.azure.com/subscriptions" --params '{"api-version":"2020-01-01"}' --output table
```

## Generate endpoint from Learn

```bash
./bin/jayz endpoint add "https://learn.microsoft.com/en-us/rest/api/appservice/web-apps/create-deployment?view=rest-appservice-2024-11-01"
./bin/jayz appservice_web_apps_create_deployment --help
```

## Output formats

- Default: `--output json`
- Table: `--output table` (uses `console.table`). If payload has an Azure-style `value` array, that is tabulated; arrays are also tabulated. Objects are rendered as key/value rows.


---

## jayz init (interactive)

Create or update `~/.config/jayz/config.json` with a guided prompt (and optionally log in afterward):

```bash
./bin/jayz init
# or
npx -y . init
```

Non-interactive mode (great for CI or scripting):

```bash
./bin/jayz init --yes   --client-id $JAYZ_CLIENT_ID   --tenant-id $JAYZ_TENANT_ID   --subscription-id $JAYZ_SUBSCRIPTION_ID   --login --mode browser
```

Notes:
- On Unix, the file is written with `chmod 600`.
- Add `--login` to perform an immediate sign-in (default mode: `browser`; also supports `device` and `secret` with `--client-secret`).



**Fixed redirect port**: jayz binds a local HTTP server on port **63265** and uses `http://localhost:63265/callback` for OAuth.

If you get a port-in-use error, close the conflicting process and try again.



### Browser OAuth (confidential app)

If your app registration must remain a **confidential** client (no public client flows), you can still use the browser login by providing a client secret. Configure your app with:

- **Single tenant** (OK)
- **Platform**: **Web**
- **Redirect URI**: `http://localhost:63265/callback`
- **Client secret**: create one and store it as `JAYZ_CLIENT_SECRET` or pass `--client-secret`

Then run:

```bash
JAYZ_CLIENT_SECRET=<secret> ./bin/jayz login
# or
./bin/jayz login --client-secret <secret>
```


### Auto-pick subscription after login

`jayz login` can set your default subscription automatically:

- If you pass `--subscription-id`, jayz saves that ID.
- Otherwise, if `--pick-subscription` (default), jayz fetches your subscriptions and:
  - If there’s only one, it saves it.
  - If there are many and you’re in a TTY, it shows a menu so you can choose.
  - If not interactive, it picks the first and tells you which one it chose.

You can disable this behavior with `--no-pick-subscription`.


### Correct subscription examples

List all subscriptions:
```bash
jayz call --method GET \
  --url "https://management.azure.com/subscriptions" \
  --params '{"api-version":"2020-01-01"}'
```

Get one subscription (uses saved `{subscriptionId}`):
```bash
jayz call --method GET \
  --url "https://management.azure.com/subscriptions/{subscriptionId}" \
  --params '{"api-version":"2020-01-01"}'
```

List resource groups:
```bash
jayz call --method GET \
  --url "https://management.azure.com/subscriptions/{subscriptionId}/resourcegroups" \
  --params '{"api-version":"2021-04-01"}' \
  --output table
```


## Endpoint utilities

### List endpoints and view help
```bash
jayz endpoint list            # prints all generated endpoint commands
jayz endpoint list --name <command>   # directly show --help for that endpoint
# Interactive (TTY): jayz endpoint list  -> pick one to show its help
```

### Update an endpoint from a Learn URL
```bash
jayz endpoint update "https://learn.microsoft.com/en-us/rest/api/appservice/web-apps/create-deployment?view=rest-appservice-2024-11-01"
# Overwrites the generated file in src/endpoints/ with fresh metadata from Learn
```
