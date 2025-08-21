# jayz

A tiny Azure REST CLI you can extend straight from Microsoft Learn pages.

## Install

```bash
npm i -g .
```

## Login

- **Default (browser OAuth + localhost callback):**

```bash
jayz login
# requires JAYZ_CLIENT_ID and JAYZ_TENANT_ID (or put them in ~/.config/jayz/config.json)
```

- Device code (user, terminal-only):

```bash
jayz login --mode device --client-id <public-app-client-id> --tenant-id <tenant-id> --subscription-id <sub-id>
```

- Client secret (service principal):

```bash
jayz login --mode secret --client-id <app-id> --client-secret <secret> --tenant-id <tenant> --subscription-id <sub-id>
```

You can also set env vars:

- `JAYZ_CLIENT_ID`, `JAYZ_CLIENT_SECRET`, `JAYZ_TENANT_ID`, `JAYZ_SUBSCRIPTION_ID`

or save to `~/.config/jayz/config.json`.

## Generic call

```bash
jayz call --method GET --url "https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.Resources/subscriptions" --params '{"api-version":"2020-01-01"}' --output table
```

## Generate endpoint from Learn

```bash
jayz endpoint add "https://learn.microsoft.com/en-us/rest/api/appservice/web-apps/create-deployment?view=rest-appservice-2024-11-01"
jayz appservice_web_apps_create_deployment --help
```

## Output formats

- Default: `--output json`
- Table: `--output table` (uses `console.table`). If payload has an Azure-style `value` array, that is tabulated; arrays are also tabulated. Objects are rendered as key/value rows.
