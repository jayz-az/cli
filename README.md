# jayz

Hackable CLI for Azure ARM & Microsoft Graph. Add endpoints from Microsoft Learn pages and call them with easy auth.

- Browser login on `http://localhost:63265/callback` (fixed port)
- Confidential app support (set `JAYZ_CLIENT_SECRET`)
- Saves config & **user endpoints** in `~/.config/jayz/`
- `endpoint list|add|update|remove|repair` with search/pick
- **Accounts:** keep multiple logins and switch between them
- **Subscriptions:** `subscription list|use|show|switch` with grep filter and picker
- Smart `--output table` (name/resourceGroup/location/type/subscriptionId/state)
- Graph endpoints supported (v1.0/beta) with correct token scope
- `init` interactive setup

## Install / Run (local, no global install)
```bash
npm install
./bin/jayz --help
```

## Quick start
```bash
# configure (interactive)
./bin/jayz init

# or non-interactive + login
./bin/jayz init -y --client-id $JAYZ_CLIENT_ID --tenant-id $JAYZ_TENANT_ID --login
```

## Login & Accounts
```bash
# user (browser); name it and make default
export JAYZ_CLIENT_ID=...   # app registration
export JAYZ_TENANT_ID=...
# If confidential app, also set secret and ensure redirect: http://localhost:63265/callback
export JAYZ_CLIENT_SECRET=...
./bin/jayz login --account user-dev

# service principal (client secret)
./bin/jayz login --mode secret --client-secret "$JAYZ_CLIENT_SECRET" --account spn-prod

# list/switch/show/remove
./bin/jayz account list --set-default
./bin/jayz account use spn-prod
./bin/jayz account show
./bin/jayz account remove user-dev
```

## Subscriptions
```bash
# show subscriptions (name + subscriptionId + state)
./bin/jayz subscription list --output table

# filter by name/ID and pick
./bin/jayz subscription list --grep prod --set-default
./bin/jayz subscription switch --grep dev
./bin/jayz subscription use             # picker
./bin/jayz subscription use <sub-id>    # direct
./bin/jayz subscription show
```

## Generic calls
```bash
# list subscriptions
./bin/jayz call --method GET --url "https://management.azure.com/subscriptions" --params '{"api-version":"2020-01-01"}'

# resource groups (uses saved {subscriptionId})
./bin/jayz call --method GET --url "https://management.azure.com/subscriptions/{subscriptionId}/resourcegroups" --params '{"api-version":"2021-04-01"}' --output table
```

## Endpoints
```bash
# add from Learn (wrap URL in quotes), saved to ~/.config/jayz/endpoints
./bin/jayz endpoint add "https://learn.microsoft.com/en-us/rest/api/appservice/web-apps/list?view=rest-appservice-2024-11-01"

# list with search and pick to show help
./bin/jayz endpoint list --grep web

# update from Learn (Graph supported, including relative paths on Learn)
./bin/jayz endpoint update "https://learn.microsoft.com/en-us/graph/api/application-list?view=graph-rest-1.0"

# remove (search then select)
./bin/jayz endpoint remove
./bin/jayz endpoint remove --grep web_apps -y

# repair older endpoints to new runtime shim
./bin/jayz endpoint repair
```

## Doctor
```bash
./bin/jayz doctor
```

## Config file
`~/.config/jayz/config.json`
```json
{
  "defaultAccount": "spn-prod",
  "accounts": {
    "user-dev": { "clientId": "000...", "tenantId": "111...", "tokenType": "browser_oauth", "refreshToken": "****", "subscriptionId": "222..." },
    "spn-prod": { "clientId": "000...", "tenantId": "111...", "clientSecret": "****", "tokenType": "client_secret", "subscriptionId": "222..." }
  }
}
```
