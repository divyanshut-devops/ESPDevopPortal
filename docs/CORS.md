# CORS from `.env`

The API only answers browser requests from origins listed in the root `.env` file. Change the list there. Do not hardcode sites in `server/src/index.js`.

## Variables

| Variable | Required | Example | What it does |
| --- | --- | --- | --- |
| `CORS_ORIGIN` | Yes | `http://localhost:3000` | Allowed website origins. Comma-separated. |
| `CORS_CREDENTIALS` | No | `true` | Allows cookies and `Authorization` headers. Default is `true`. |
| `FRONTEND_URL` | Yes | `http://localhost:3000` | Portal URL for invite emails. Also treated as an allowed CORS origin. |

Copy values from `.env.example` if you are setting up a new machine.

## Local development

```env
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true
```

Restart the app after you edit `.env`:

```bash
npm run dev
```

## Production

Use the live HTTPS origin only. Do not leave `*` in production if users sign in.

```env
FRONTEND_URL=https://devops.example.com
CORS_ORIGIN=https://devops.example.com
CORS_CREDENTIALS=true
```

Several sites:

```env
CORS_ORIGIN=https://devops.example.com,https://admin.example.com
```

## Open access (not for sign-in)

`CORS_ORIGIN=*` allows every origin and turns credentials off. Use this only for a public, non-authenticated probe.

## How it is applied

- File: `server/src/corsConfig.js`
- Wired in: `server/src/index.js` with `app.use(cors(corsOptions()))`
- Docker Compose reads the same root `.env` through `env_file` and passes `CORS_ORIGIN`, `CORS_CREDENTIALS`, and `FRONTEND_URL` into the `web` service

Same-origin requests (no `Origin` header) still work. A browser on a site that is not listed gets a CORS error.

## Check it

```bash
curl -i -X OPTIONS http://localhost:3000/api/health \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET"
```

You should see `Access-Control-Allow-Origin: http://localhost:3000`.
