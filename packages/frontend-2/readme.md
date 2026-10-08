# frontend-2 🏬

The replacement for our old Vue 2 Vue CLI frontend SPA app. This one's built with Vue 3, Nuxt 3, Tailwind and is server side rendered. Should be a faster and nicer experience both for our devs and our users!

Look at the [nuxt 3 documentation](https://v3.nuxtjs.org) to learn more.

## Setup

Make sure to install the dependencies:

```bash
yarn install
```

And create an `.env` file from `.env.example`.

### WSL2 on Windows

Remove the HOST env var from your `.env` file as its known to cause performance issues with the Nuxt dev server: https://github.com/nuxt/cli/issues/209

## Development

Start the development server on http://localhost:8081

```bash
yarn dev
```

### Develop against a remote server

If you don't want to run the whole stack locally (server, postgres, redis, ...), you can run the
frontend locally and let a small dev proxy forward all backend traffic to a remote Speckle server.
This keeps the browser on a single origin, so cookies, redirects, file uploads/downloads and
GraphQL subscriptions (WebSockets) behave exactly like they do behind the production ingress.

```bash
# from the repo root
yarn dev:frontend-2:remote
# or from this package
yarn dev:remote
```

Then open **http://127.0.0.1:8081** (not `:3001` - that's the internal `nuxt dev` port).

Topology:

```
browser -> http://127.0.0.1:8081 (dev proxy, tools/dev-remote-proxy.mjs)
              |- /graphql, /api/**, /auth/**, /objects/**, /preview/**, /static/**, ...
              |     -> http://47.100.77.97:64482   (remote server, HTTP + WebSocket)
              '- everything else
                    -> http://127.0.0.1:3001       (local `nuxt dev`, HTTP + Vite HMR WebSocket)
```

The remote server, ports and the proxied path prefixes are configured in `.env.remote`
(`DEV_PROXY_TARGET`, `DEV_PROXY_PORT`, `DEV_PROXY_FRONTEND`, `DEV_PROXY_BACKEND_PATHS`,
`DEV_PROXY_LOCAL_PATHS`). Set `DEV_PROXY_VERBOSE=1` there to log every proxied request.

Note: `/authn/**` are frontend pages and stay local, while `/auth/**` endpoints go to the remote
server - prefix matching happens on path segment boundaries, so the two never collide.

### Typed GraphQL

Type your queries & fragments using the `graphql()` helper from `~~/lib/common/generated/gql` and then run `yarn gqlgen` (or `yarn gqlgen:watch` to run it in watch mode) to generated TS typing information for these GQL documents.

More info: https://the-guild.dev/blog/unleash-the-power-of-fragments-with-graphql-codegen

### Troubleshooting

#### ESLint results doesn't update after GQL type regeneration

Restart the ESLint plugin through VSCode's command palette, this is a bug with the ESLint plugin.

#### GraphQL codegen throws an error like "Unknown fragment XXX" or something else that doesn't make sense

Sometimes the codegen throws misleading errors and the issue is actually something completely different so I suggest removing the new graphql fragments/operations you've added one by one until the generation works again, to isolate the problematic graphql code. And then thoroughly investigate the fragments/operations you've added, because you might have a syntax error somewhere.

## Production

Build the application for production:

```bash
yarn build
```

You can serve the production build locally by running `yarn preview` afterwards.

Checkout the [deployment documentation](https://v3.nuxtjs.org/guide/deploy/presets) for more information.
