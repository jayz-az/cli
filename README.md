# jayz

Hackable CLI for Azure ARM & Microsoft Graph. Add endpoints from Microsoft Learn pages and call them with easy auth.

- Browser login on `http://localhost:63265/callback` (fixed port)
- Confidential app support (set `JAYZ_CLIENT_SECRET`)
- Saves config & **user endpoints** in `~/.config/jayz/`
- `endpoint list|add|update|remove|repair`
- **Accounts:** keep multiple logins and switch between them
- Smart `--output table` (name/resourceGroup/location/type fallback to id)
- Graph endpoints supported (v1.0/beta) with correct token scope

## Run locally (no global install)
```bash
npm install
./bin/jayz --help
```

## Login
```bash
# user (browser); name it and make default
export JAYZ_CLIENT_ID=...
export JAYZ_TENANT_ID=...
# If your app is confidential, also set a secret and ensure the redirect: http://localhost:63265/callback
export JAYZ_CLIENT_SECRET=...
./bin/jayz login --account user-dev

# service principal (client secret)
./bin/jayz login --mode secret --client-secret "$JAYZ_CLIENT_SECRET" --account spn-prod
```

## Accounts
```bash
./bin/jayz account list --set-default
./bin/jayz account use spn-prod
./bin/jayz account show
./bin/jayz account remove user-dev
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
./bin/jayz endpoint add "https://learn.microsoft.com/en-us/rest/api/appservice/web-apps/create-deployment?view=rest-appservice-2024-11-01"

# list with search and pick to show help
./bin/jayz endpoint list --grep web

# update existing endpoint by re-scraping Learn (Graph supported)
./bin/jayz endpoint update "https://learn.microsoft.com/en-us/graph/api/application-post-owners?view=graph-rest-1.0"

# remove (search then select)
./bin/jayz endpoint remove
./bin/jayz endpoint remove --grep web_apps -y

# repair older endpoints to new runtime shim
./bin/jayz endpoint repair
```

## Graph notes
- Graph endpoints auto-scope tokens to `https://graph.microsoft.com/.default`.
- Ensure your app has the required Graph permissions and admin consent.

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
