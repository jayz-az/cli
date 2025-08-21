# jayz

A tiny, hackable CLI for Azure REST. Point it at a Microsoft Learn REST doc and it scaffolds a runnable command. Batteries included for auth, config, and output formatting.

- **Local-first**: run from the repo (no global install required)
- **Easy auth**: Browser OAuth (default), or Device Code / Client Secret
- **Config**: env vars (`JAYZ_*`) or `~/.config/jayz/config.json`
- **Add endpoints**: `jayz endpoint add <learn-url>`
- **Output**: `--output json` (default) or `--output table`

---

## Table of contents

- [Requirements](#requirements)
- [Install / Run (local, no globals)](#install--run-local-no-globals)
- [Configuration](#configuration)
  - [Env vars (`JAYZ_*`)](#env-vars-jayz_)
  - [Config file (`~/.config/jayz/config.json`)](#config-file-configjayzconfigjson)
- [Authentication](#authentication)
  - [Browser OAuth (default)](#browser-oauth-default)
  - [Device Code](#device-code)
  - [Client Secret (app-only)](#client-secret-app-only)
  - [Permissions / RBAC](#permissions--rbac)
  - [Troubleshooting auth](#troubleshooting-auth)
- [Usage](#usage)
  - [Generic REST calls](#generic-rest-calls)
  - [Generate commands from Learn pages](#generate-commands-from-learn-pages)
  - [Output formats](#output-formats)
- [Development](#development)
  - [Project layout](#project-layout)
  - [Coding notes](#coding-notes)
  - [Adding features](#adding-features)
- [Security](#security)
- [Roadmap / Ideas](#roadmap--ideas)

---

## Requirements

- **Node.js 18+**
- An **Azure AD app registration** (public client for user flows)
- Azure subscription access (RBAC) for whatever you want to call

---

## Install / Run (local, no globals)

Clone your repo, then:

```bash
npm install
```

Pick any of these ways to run:

**A) Direct binary (macOS/Linux):**
```bash
./bin/jayz --help
./bin/jayz login
```

**B) Direct binary (Windows):**
```powershell
node bin/jayz --help
node bin/jayz login
```

**C) `npx` on the local folder:**
```bash
npx -y . --help
npx -y . login
```

**D) Add to PATH for this shell session:**
```bash
export PATH="$PWD/bin:$PATH"
jayz --help
```

> You can still install globally if you want: `npm i -g .`

---

## Configuration

jayz merges config in this order:

**CLI flags ⟶ env vars (`JAYZ_*`) ⟶ `~/.config/jayz/config.json`**

### Env vars (`JAYZ_*`)

```bash
export JAYZ_CLIENT_ID=<your_aad_app_client_id>
export JAYZ_TENANT_ID=<your_tenant_id>
# optional:
export JAYZ_SUBSCRIPTION_ID=<default_subscription_id>
# optional (sovereign clouds):
# export JAYZ_AUTHORITY_HOST="https://login.microsoftonline.us"
```

### Config file (`~/.config/jayz/config.json`)

Minimal:
```json
{
  "clientId": "00000000-0000-0000-0000-000000000000",
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "subscriptionId": "22222222-2222-2222-2222-222222222222"
}
```

Sovereign (optional):
```json
{
  "clientId": "00000000-0000-0000-0000-000000000000",
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "subscriptionId": "22222222-2222-2222-2222-222222222222",
  "authorityHost": "https://login.microsoftonline.us"
}
```

If you intend to use **client secret** mode and accept storing it:
```json
{
  "clientId": "00000000-0000-0000-0000-000000000000",
  "clientSecret": "your-super-secret",
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "subscriptionId": "22222222-2222-2222-2222-222222222222"
}
```

> After first login, jayz will also write tokens (access/refresh) and `tokenType` into this file.

---

## Authentication

### Browser OAuth (default)

Just run:
```bash
jayz login
```

- Requires **JAYZ_CLIENT_ID** and **JAYZ_TENANT_ID** (via env or config file).
- jayz starts a temporary **localhost** server and opens your browser for consent.
- Stores a **refresh token** for silent reuse next time.

**App registration tips**
- Register as a **Public client / native** capable app (no client secret required).
- Add a **Redirect URI** suitable for loopback on desktop (e.g., `http://localhost`). If you see redirect URI errors, add `http://127.0.0.1` too.
- Grant **API permission** for **Azure Service Management → Delegated → `user_impersonation`** so ARM can accept tokens acquired on behalf of the user. RBAC still decides what the user can do.

### Device Code

If you prefer a browserless prompt in the terminal:
```bash
npm i msal-node   # local dependency for this mode
jayz login --mode device --client-id $JAYZ_CLIENT_ID --tenant-id $JAYZ_TENANT_ID
```

### Client Secret (app-only)

For service principals / automation:
```bash
npm i msal-node   # local dependency for this mode
jayz login --mode secret --client-id $JAYZ_CLIENT_ID --client-secret <secret> --tenant-id $JAYZ_TENANT_ID
```

> With client credentials, you don’t add delegated API permissions; assign **RBAC** to the service principal at the right scope.

### Permissions / RBAC

- **User login (Browser / Device Code)**: add **Azure Service Management → Delegated → `user_impersonation`** to your app; consent needed. Actions are enforced by **user RBAC**.
- **App-only (Client Secret)**: **no delegated permissions** needed; assign **RBAC** to the service principal.

### Troubleshooting auth

- **AADSTS50011 (invalid redirect URI)**: add `http://localhost` (and optionally `http://127.0.0.1`) to the app’s **Redirect URIs**.
- **Need admin consent / insufficient privileges**: an admin must consent to **Azure Service Management → `user_impersonation`**.
- **RBAC denied (403)**: ensure your user or service principal has the right role (Reader/Contributor/Owner) at the intended scope.

---

## Usage

### Generic REST calls

```bash
# default JSON output
jayz call --method GET   --url "https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.Resources/subscriptions"   --params '{"api-version":"2020-01-01"}'

# table output
jayz call --method GET   --url "https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.Resources/subscriptions"   --params '{"api-version":"2020-01-01"}'   --output table
```

Notes:
- `{subscriptionId}` is auto-filled from `JAYZ_SUBSCRIPTION_ID` or config if omitted.
- `--params` and `--body` accept **JSON strings**.

### Generate commands from Learn pages

```bash
jayz endpoint add "https://learn.microsoft.com/en-us/rest/api/appservice/web-apps/create-deployment?view=rest-appservice-2024-11-01"

# Then inspect & run the generated command:
jayz appservice_web_apps_create_deployment --help
jayz appservice_web_apps_create_deployment   --resourceGroupName rg1   --name mywebapp   --body '{"properties":{"message":"deploy via jayz"}}'   --output table
```

What happens:
- jayz scrapes the **HTTP request** section (method + URL) and captures path params like `{resourceGroupName}`, `{name}`, etc.
- It infers the `api-version` from the `view=rest-<service>-<YYYY-MM-DD>` query.
- A new command module is written into `src/endpoints/` and auto-registered on next run.

### Output formats

- `--output json` (default): pretty-prints the response
- `--output table`: smartly tables arrays or common Azure shapes (prefers `.value` arrays)

---

## Development

### Project layout

```
bin/jayz                 # CLI entry
src/
  index.js               # yargs bootstrap + endpoint auto-loader
  config.js              # env/file/flag merge; ~/.config/jayz/config.json
  auth.js                # Browser OAuth (default) + optional device/secret support
  http.js                # axios wrapper
  format.js              # --output json|table
  commands/
    login.js             # jayz login
    call.js              # jayz call
    endpoint-add.js      # Generates endpoint commands from Learn URLs
  endpoints/
    index.js             # auto-load generated commands
    ...generated.js      # created by endpoint-add
templates/
  endpoint.template.js   # scaffold used by endpoint-add
```

### Coding notes

- **Node 18+** (uses modern APIs)
- **CommonJS** modules for simplicity
- Dependencies are kept minimal:
  - `axios` for HTTP
  - `yargs` for CLI
  - `cheerio` for scraping Learn docs
- Device/secret modes require `msal-node` (optional). Install locally if you use them:
  ```bash
  npm i msal-node
  ```

### Adding features

Some easy extensions:
- `--select name,location` for table output
- `--output yaml`
- Polling for **long-running operations** (Azure-AsyncOperation header)
- `jayz init` to write `config.json` interactively
- `jayz check-perms` to verify app permissions and SP RBAC

---

## Security

- Treat `~/.config/jayz/config.json` like a secret store (it can hold tokens and, if you choose, a client secret).
- On Unix:
  ```bash
  chmod 600 ~/.config/jayz/config.json
  ```
- Prefer **Browser OAuth** or **Device Code** for local/dev. Avoid storing client secrets on disk unless necessary.
- For CI, prefer **Client Secret** with scoped RBAC and short-lived secrets or **federated identity**.

---

## Roadmap / Ideas

- Rich output: YAML, CSV, and jq-like projections
- Built-in examples/tests per generated endpoint
- Retry/backoff helpers and 429 handling
- Workload identity (federated credentials) support for CI
- Configurable redirect host (e.g., `JAYZ_REDIRECT_HOST=localhost`)

---

Happy hacking! If you run into a specific endpoint that needs special handling (paging, polling, multipart, etc.), open a note/issue and we can bake it into the generator template.
