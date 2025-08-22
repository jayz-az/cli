# jayz

Hackable CLI for Azure ARM & Microsoft Graph. Add endpoints from Microsoft Learn pages and call them with easy auth.

- Browser login on `http://localhost:63265/callback` (fixed port)
- Confidential app support (set `JAYZ_CLIENT_SECRET`)
- Saves config & user endpoints in `~/.config/jayz/`
- `endpoint add|update|list|remove|repair`
- Smart `--output table` (name/resourceGroup/location/type fallback to id)

## Run locally (no global install)
```bash
npm install
./bin/jayz --help
```

## Login
```bash
# browser (confidential app ok if you set a secret)
export JAYZ_CLIENT_ID=...
export JAYZ_TENANT_ID=...
export JAYZ_CLIENT_SECRET=...   # required if your app is confidential
./bin/jayz login
```

## Generic calls
```bash
# list subscriptions
./bin/jayz call --method GET --url "https://management.azure.com/subscriptions" --params '{"api-version":"2020-01-01"}'

# one subscription (uses saved {subscriptionId})
./bin/jayz call --method GET --url "https://management.azure.com/subscriptions/{subscriptionId}" --params '{"api-version":"2020-01-01"}'

# resource groups (table)
./bin/jayz call --method GET --url "https://management.azure.com/subscriptions/{subscriptionId}/resourcegroups" --params '{"api-version":"2021-04-01"}' --output table
```

## Endpoints
```bash
# add from Learn (wrap URL in quotes), saved to ~/.config/jayz/endpoints
./bin/jayz endpoint add "https://learn.microsoft.com/en-us/rest/api/appservice/web-apps/create-deployment?view=rest-appservice-2024-11-01"

# list with search and pick to show help
./bin/jayz endpoint list --grep web

# update existing endpoint by re-scraping Learn
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
  "clientId": "00000000-0000-0000-0000-000000000000",
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "subscriptionId": "22222222-2222-2222-2222-222222222222"
}
```
