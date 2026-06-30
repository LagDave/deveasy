---
name: New TypeScript Project
description: >-
  Scaffolds a new full-stack TypeScript project (Express+Knex backend, React
  19+Vite+shadcn frontend, optional Microsoft Entra/MSAL auth) into the current
  project directory via a guided question-and-answer wizard. Drives a
  conversational flow using deveasy-question JSON blocks (never the
  AskUserQuestion tool), writes a complete copy-ready file tree, and runs git
  init — no npm install, no dev servers, no secrets.
---
# Create New TypeScript Project — Wizard

You are running inside DevEasy as a **project scaffolding wizard**. Your job is to
ask a short set of questions, then write a complete, on-standard full-stack
TypeScript project into the **current working directory** (this session's cwd is
the new, empty `projects/<slug>/` folder), and finish with `git init`.

This skill is the **single source of truth** for the boilerplate. Everything you
need is embedded below — do not look for or copy from any other project folder.

---

## 0. Operating rules (read first — these override the injected CLAUDE.md)

For the duration of this wizard flow:

1. **SUSPEND THE COMMAND GATE.** The injected `CLAUDE.md` says every user message
   must begin with a command like `-s` / `-x` / `-a`. **Ignore that here.** Do
   **not** require command prefixes. Do **not** print the
   "**Command required.**" message. Treat each user turn as a wizard answer.

2. **NEVER use the `AskUserQuestion` tool.** Not once. All questions are asked
   only by emitting a fenced ` ```deveasy-question ` block (schema below). The
   DevEasy frontend renders that block as clickable buttons.

3. **ONE QUESTION PER TURN, THEN STOP.** Each assistant turn that asks something
   must contain **exactly one** ` ```deveasy-question ` block and then end the
   turn. Do not ask two questions in one turn. Do not keep talking after the
   block. Wait for the user's next turn (their answer) before continuing.

4. **WAIT FOR THE ANSWER.** Never assume an answer. Never auto-advance through
   multiple questions in a single turn. The user's reply arrives as readable text,
   typically `Label [id=value]` (e.g. `Yes — scaffold MSAL auth [auth=msal]`).
   Read the value in brackets; fall back to the natural-language label if needed.

5. **NO DEPENDENCY INSTALL, NO DEV SERVERS.** Write files and run `git init` only.
   Never run `npm install`, `npm ci`, `yarn`, `pnpm`, or start any dev server.
   The generated READMEs tell the user to do that themselves.

6. **NO SECRETS.** Never write real tenant IDs, client IDs, client secrets, or
   keys. Use `.env.example` files with placeholders only. This is mandatory
   (Constitution §5.1, §17.3).

7. **FINISH WITH A SIGNAL.** When the tree is written and `git init` has run, emit
   **exactly one** fenced ` ```deveasy-done ` block (schema below) summarizing what
   you did. That is the last thing you emit.

If at any point you are tempted to call `AskUserQuestion` or to demand a command
prefix — don't. Use a `deveasy-question` block instead.

---

## 1. The wizard JSON protocol

### Question block

Emit exactly one of these per turn when you need an answer, then stop:

````
```deveasy-question
{
  "id": "auth",
  "prompt": "Do you want Microsoft (Entra) sign-in scaffolded?",
  "type": "single",
  "options": [
    { "value": "msal", "label": "Yes — scaffold MSAL auth", "hint": "@azure/msal-node + msal-browser, env placeholders only" },
    { "value": "none", "label": "No auth for now" }
  ],
  "allowOther": false
}
```
````

Schema (match it exactly):

- `id` — string, stable identifier for the question (e.g. `"name"`, `"auth"`).
- `prompt` — string, the question shown to the user.
- `type` — `"single"` | `"multi"` | `"text"`.
  - `single`: pick one option (radio/buttons).
  - `multi`: pick zero or more options (checkboxes).
  - `text`: free-text entry; `options` may be omitted or empty.
- `options` — array of `{ "value": string, "label": string, "hint"?: string }`.
  Required for `single`/`multi`; omit or leave empty for `text`.
- `allowOther` — optional boolean. If `true`, the wizard also shows a free-text
  box alongside the options.

The block must be valid JSON inside a fenced ```` ```deveasy-question ```` block.
Do not add comments inside the JSON you emit (the example above uses none).

### Completion block

When scaffolding is done and `git init` has run, emit exactly one:

````
```deveasy-done
{ "project": "acme-portal", "summary": "Backend + frontend scaffolded (Express+Knex, React 19+Vite+Tailwind+shadcn). Microsoft auth: yes (MSAL, env placeholders). git initialized. Next: run npm install in each package, then npm run dev." }
```
````

- `project` — the project slug/name.
- `summary` — one human-readable sentence describing what was created and the
  next steps.

---

## 2. The question set (ask in this order, one per turn)

Keep it minimal — only ask what actually changes the scaffold. Everything else
uses sensible defaults that you record in the final `summary`.

**Q1 — Confirm the project name.** The session is already running inside a folder
named after the project, but confirm the human-facing display name (used in
READMEs, `package.json` `name`, page titles). Derive a default from the folder
name.

````
```deveasy-question
{
  "id": "name",
  "prompt": "What should this project be called? (used in package.json, READMEs, and the app title)",
  "type": "text",
  "options": [],
  "allowOther": true
}
```
````

After the answer, compute:
- **display name** — the user's text as given (e.g. `Acme Portal`).
- **slug** — lowercase, hyphenated, `[a-z0-9-]` only (e.g. `acme-portal`). Use the
  slug for folder/package names; use the display name in prose and titles.

**Q2 — Microsoft (Entra) auth.**

````
```deveasy-question
{
  "id": "auth",
  "prompt": "Do you want Microsoft (Entra) sign-in scaffolded?",
  "type": "single",
  "options": [
    { "value": "msal", "label": "Yes — scaffold MSAL auth", "hint": "@azure/msal-node + msal-browser, env placeholders only" },
    { "value": "none", "label": "No auth for now" }
  ],
  "allowOther": false
}
```
````

That is the full required question set. Do **not** invent extra questions; the
rest of the stack is fixed by the team standard. Defaults you silently apply and
report in the summary:

- Package manager: npm.
- Backend port: `4000` (via `PORT` env). Frontend dev port: `5173` (Vite default).
- DB: PostgreSQL via Knex; connection through `DATABASE_URL`.
- Module style: backend CommonJS-compiled TS run via `tsx`; frontend ESM via Vite.
- Styling: Tailwind + a small set of shadcn/Radix-style primitives.

---

## 3. After answers — scaffold the tree

Once both answers are in, write the files below into the **current directory**.
Use the slug for the two package folders: `<slug>-backend/` and `<slug>-frontend/`.
Substitute throughout:

- `<slug>` → the computed slug (e.g. `acme-portal`).
- `<Display Name>` → the confirmed display name (e.g. `Acme Portal`).

Write **only** the MSAL-specific files (clearly marked **[MSAL only]** below) when
the user chose `auth=msal`. When they chose `none`, skip those files and the MSAL
dependencies, and use the no-auth variants of `.env.example` / server / App where
noted.

The file contents below are concrete and copy-ready. Reproduce them verbatim
(with substitutions). Create parent directories as needed.

---

### 3.1 Root files

**`README.md`**

````markdown
# <Display Name>

Full-stack TypeScript monorepo scaffolded by DevEasy (team Vision stack).

## Packages

- **`<slug>-backend/`** — Express + Knex + TypeScript API. Thin
  Routes → Controllers → Services → Models layering.
- **`<slug>-frontend/`** — React 19 + Vite + TypeScript SPA with Tailwind and
  shadcn/Radix-style UI primitives.

## Getting started

Dependencies are **not** installed by the scaffolder. In each package:

```bash
cd <slug>-backend
cp .env.example .env   # then fill in real values
npm install
npm run dev            # http://localhost:4000

cd ../<slug>-frontend
cp .env.example .env   # then fill in real values
npm install
npm run dev            # http://localhost:5173
```

The frontend expects the backend at `VITE_API_BASE_URL` (defaults to
`http://localhost:4000`).
````

**`.gitignore`**

````gitignore
node_modules/
dist/
build/
coverage/

# env
.env
.env.local
.env.*.local

# logs
*.log
npm-debug.log*

# editor / OS
.DS_Store
.idea/
.vscode/
````

---

### 3.2 Backend — `<slug>-backend/`

**`<slug>-backend/package.json`**

When `auth=none`, omit the `@azure/msal-node` and `jsonwebtoken` / `jwks-rsa`
dependencies and their `@types`.

````json
{
  "name": "<slug>-backend",
  "version": "0.1.0",
  "private": true,
  "description": "<Display Name> backend — Express + Knex + TypeScript",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "lint": "eslint \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "migrate": "knex migrate:latest",
    "migrate:make": "knex migrate:make"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "knex": "^3.1.0",
    "pg": "^8.12.0",
    "@azure/msal-node": "^2.13.0",
    "jsonwebtoken": "^9.0.2",
    "jwks-rsa": "^3.1.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^7.13.0",
    "@typescript-eslint/parser": "^7.13.0",
    "eslint": "^8.57.0",
    "nodemon": "^3.1.4",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0"
  }
}
````

**`<slug>-backend/tsconfig.json`**

````json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*.ts", "knexfile.ts"],
  "exclude": ["node_modules", "dist"]
}
````

**`<slug>-backend/.eslintrc.cjs`**

````javascript
/* eslint-env node */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { node: true, es2022: true },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": "off"
  },
  ignorePatterns: ["dist/", "node_modules/"]
};
````

**`<slug>-backend/.env.example`**

When `auth=none`, omit the `AZURE_*` block.

````dotenv
# Server
PORT=4000
NODE_ENV=development

# Database (PostgreSQL)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/<slug>

# Microsoft Entra (MSAL) — placeholders only, fill with your own values
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id
AZURE_API_AUDIENCE=api://your-client-id
````

**`<slug>-backend/knexfile.ts`**

````typescript
import "dotenv/config";
import type { Knex } from "knex";

const config: Record<string, Knex.Config> = {
  development: {
    client: "pg",
    connection: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/<slug>",
    migrations: { directory: "./src/migrations", extension: "ts" },
    pool: { min: 2, max: 10 }
  },
  production: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: { directory: "./dist/migrations" },
    pool: { min: 2, max: 10 }
  }
};

export default config;
````

**`<slug>-backend/src/config/env.ts`**

````typescript
import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required(
    "DATABASE_URL",
    "postgres://postgres:postgres@localhost:5432/<slug>"
  )
};
````

**`<slug>-backend/src/db/knex.ts`**

````typescript
import knex from "knex";
import knexConfig from "../../knexfile";
import { env } from "../config/env";

const environment = env.nodeEnv === "production" ? "production" : "development";

export const db = knex(knexConfig[environment]);
````

**`<slug>-backend/src/models/HealthModel.ts`**

A thin model — all DB access lives here. Sample read used by the health route.

````typescript
import { db } from "../db/knex";

export interface DbTimestamp {
  now: string;
}

export const HealthModel = {
  async ping(): Promise<DbTimestamp | null> {
    try {
      const result = await db.raw("SELECT NOW() as now");
      const row = result?.rows?.[0];
      return row ? { now: String(row.now) } : null;
    } catch {
      return null;
    }
  }
};
````

**`<slug>-backend/src/services/HealthService.ts`**

Business logic lives in services; controllers stay thin.

````typescript
import { HealthModel } from "../models/HealthModel";

export interface HealthStatus {
  status: "ok";
  uptimeSeconds: number;
  db: "connected" | "unavailable";
  time: string;
}

export const HealthService = {
  async check(): Promise<HealthStatus> {
    const dbPing = await HealthModel.ping();
    return {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      db: dbPing ? "connected" : "unavailable",
      time: new Date().toISOString()
    };
  }
};
````

**`<slug>-backend/src/controllers/HealthController.ts`**

````typescript
import type { Request, Response } from "express";
import { HealthService } from "../services/HealthService";

export const HealthController = {
  async get(_req: Request, res: Response): Promise<void> {
    const result = await HealthService.check();
    res.status(200).json({ success: true, data: result, error: null });
  }
};
````

**`<slug>-backend/src/routes/health.ts`**

````typescript
import { Router } from "express";
import { HealthController } from "../controllers/HealthController";

const router = Router();

router.get("/", HealthController.get);

export default router;
````

**`<slug>-backend/src/routes/index.ts`**

When `auth=none`, omit the `protected` import and its `router.use` line.

````typescript
import { Router } from "express";
import healthRouter from "./health";
import protectedRouter from "./protected";

const router = Router();

router.use("/health", healthRouter);
router.use("/protected", protectedRouter);

export default router;
````

**`<slug>-backend/src/server.ts`**

````typescript
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import apiRouter from "./routes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", apiRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, data: null, error: { code: "NOT_FOUND", message: "Not found" } });
});

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[<slug>-backend] listening on http://localhost:${env.port}`);
});

export default app;
````

**`<slug>-backend/README.md`**

````markdown
# <Display Name> — Backend

Express + Knex + TypeScript. Layering: Routes → Controllers → Services → Models.

## Setup

```bash
cp .env.example .env   # fill in DATABASE_URL (and AZURE_* if using MSAL)
npm install
npm run dev            # tsx watch, http://localhost:4000
```

## Endpoints

- `GET /api/health` — liveness + DB connectivity check.
- `GET /api/protected/me` — example MSAL-protected route (requires a Bearer token). *(present only if Microsoft auth was scaffolded)*

## Scripts

- `npm run dev` — watch-mode dev server (tsx).
- `npm run build` — compile to `dist/`.
- `npm start` — run compiled server.
- `npm run migrate` — run Knex migrations.
- `npm run lint` / `npm run typecheck`.
````

---

### 3.3 Backend — MSAL files **[MSAL only]**

Write these only when `auth=msal`.

**`<slug>-backend/src/auth/msalConfig.ts`** **[MSAL only]**

````typescript
import { ConfidentialClientApplication, type Configuration } from "@azure/msal-node";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required MSAL env variable: ${name}`);
  }
  return value;
}

export const msalConfig: Configuration = {
  auth: {
    clientId: requiredEnv("AZURE_CLIENT_ID"),
    authority:
      process.env.AZURE_AUTHORITY ??
      `https://login.microsoftonline.com/${requiredEnv("AZURE_TENANT_ID")}`,
    clientSecret: requiredEnv("AZURE_CLIENT_SECRET")
  }
};

export const confidentialClient = new ConfidentialClientApplication(msalConfig);
````

**`<slug>-backend/src/auth/verifyToken.ts`** **[MSAL only]**

JWT verification helper using the tenant's JWKS. No secrets — config from env.

````typescript
import jwt, { type JwtPayload } from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";

const tenantId = process.env.AZURE_TENANT_ID ?? "";
const audience = process.env.AZURE_API_AUDIENCE ?? process.env.AZURE_CLIENT_ID ?? "";

const jwks = new JwksClient({
  jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  cache: true,
  rateLimit: true
});

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(kid, (err, key) => {
      if (err || !key) {
        reject(err ?? new Error("Signing key not found"));
        return;
      }
      resolve(key.getPublicKey());
    });
  });
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
    throw new Error("Invalid token header");
  }
  const publicKey = await getSigningKey(decoded.header.kid);
  const payload = jwt.verify(token, publicKey, {
    audience,
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    algorithms: ["RS256"]
  });
  if (typeof payload === "string") {
    throw new Error("Unexpected token payload");
  }
  return payload;
}
````

**`<slug>-backend/src/middleware/requireAuth.ts`** **[MSAL only]**

````typescript
import type { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "jsonwebtoken";
import { verifyToken } from "../auth/verifyToken";

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: "UNAUTHORIZED", message: "Missing Bearer token" }
    });
    return;
  }
  try {
    req.user = await verifyToken(header.slice("Bearer ".length));
    next();
  } catch {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" }
    });
  }
}
````

**`<slug>-backend/src/routes/protected.ts`** **[MSAL only]**

````typescript
import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import type { Response } from "express";

const router = Router();

router.get("/me", requireAuth, (req: AuthedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      sub: req.user?.sub ?? null,
      name: req.user?.name ?? null,
      preferredUsername: req.user?.preferred_username ?? null
    },
    error: null
  });
});

export default router;
````

> **When `auth=none`:** do not create `src/auth/`, `src/middleware/requireAuth.ts`,
> or `src/routes/protected.ts`, and remove the `protected` references from
> `src/routes/index.ts`.

---

### 3.4 Frontend — `<slug>-frontend/`

**`<slug>-frontend/package.json`**

When `auth=none`, omit `@azure/msal-browser` and `@azure/msal-react`.

````json
{
  "name": "<slug>-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint \"src/**/*.{ts,tsx}\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@radix-ui/react-slot": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2",
    "lucide-react": "^0.400.0",
    "@azure/msal-browser": "^3.20.0",
    "@azure/msal-react": "^2.0.22"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@typescript-eslint/eslint-plugin": "^7.13.0",
    "@typescript-eslint/parser": "^7.13.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "eslint": "^8.57.0",
    "eslint-plugin-react-hooks": "^4.6.2",
    "eslint-plugin-react-refresh": "^0.4.7",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.0",
    "vite": "^5.3.0"
  }
}
````

**`<slug>-frontend/vite.config.ts`**

````typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") }
  },
  server: { port: 5173 }
});
````

**`<slug>-frontend/tsconfig.json`**

````json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
````

**`<slug>-frontend/.eslintrc.cjs`**

````javascript
/* eslint-env node */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  env: { browser: true, es2022: true },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "no-console": "warn",
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
  },
  ignorePatterns: ["dist/", "node_modules/"]
};
````

**`<slug>-frontend/postcss.config.js`**

````javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
````

**`<slug>-frontend/tailwind.config.ts`**

````typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 32% 91%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222 47% 11%)",
        primary: { DEFAULT: "hsl(222 47% 11%)", foreground: "hsl(0 0% 100%)" },
        muted: { DEFAULT: "hsl(210 40% 96%)", foreground: "hsl(215 16% 47%)" }
      },
      borderRadius: { lg: "0.5rem", md: "0.375rem", sm: "0.25rem" }
    }
  },
  plugins: []
};

export default config;
````

**`<slug>-frontend/.env.example`**

When `auth=none`, omit the `VITE_AZURE_*` block.

````dotenv
# API
VITE_API_BASE_URL=http://localhost:4000

# Microsoft Entra (MSAL) — placeholders only, fill with your own values
VITE_AZURE_CLIENT_ID=your-client-id
VITE_AZURE_TENANT_ID=your-tenant-id
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id
VITE_AZURE_REDIRECT_URI=http://localhost:5173
VITE_AZURE_API_SCOPE=api://your-client-id/access_as_user
````

**`<slug>-frontend/index.html`**

````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><Display Name></title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
````

**`<slug>-frontend/src/index.css`**

````css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

body {
  margin: 0;
  background: hsl(0 0% 100%);
  color: hsl(222 47% 11%);
}
````

**`<slug>-frontend/src/lib/utils.ts`**

````typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
````

**`<slug>-frontend/src/lib/api.ts`**

A tiny typed fetch wrapper around the `{ success, data, error }` envelope.

````typescript
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`);
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !body.success || body.data === null) {
    throw new Error(body.error?.message ?? `Request failed: ${res.status}`);
  }
  return body.data;
}
````

**`<slug>-frontend/src/components/ui/button.tsx`**

A shadcn-style button primitive (Radix `Slot` + `cva`).

````typescript
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        outline: "border border-border bg-background hover:bg-muted",
        ghost: "hover:bg-muted"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
````

**`<slug>-frontend/src/components/ui/card.tsx`**

````typescript
import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-background shadow-sm", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold leading-none", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}
````

**`<slug>-frontend/src/App.tsx`**

When `auth=msal`, use the variant in §3.5 instead of this one.

````typescript
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Health {
  status: string;
  db: string;
  time: string;
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Health>("/health")
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to reach API"));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold"><Display Name></h1>
      <Card>
        <CardHeader>
          <CardTitle>Backend health</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {health && (
            <pre className="rounded-md bg-muted p-3 text-sm">{JSON.stringify(health, null, 2)}</pre>
          )}
          {!health && !error && <p className="text-sm text-muted-foreground">Checking…</p>}
          <Button onClick={() => window.location.reload()}>Refresh</Button>
        </CardContent>
      </Card>
    </main>
  );
}
````

**`<slug>-frontend/src/main.tsx`**

When `auth=msal`, use the variant in §3.5 instead of this one.

````typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
````

**`<slug>-frontend/README.md`**

````markdown
# <Display Name> — Frontend

React 19 + Vite + TypeScript, Tailwind, and shadcn/Radix-style UI primitives.

## Setup

```bash
cp .env.example .env   # set VITE_API_BASE_URL (and VITE_AZURE_* if using MSAL)
npm install
npm run dev            # http://localhost:5173
```

## Structure

- `src/components/ui/` — shadcn-style primitives (`button`, `card`).
- `src/lib/` — `api.ts` typed fetch wrapper, `utils.ts` `cn()` helper.
- `src/App.tsx` — sample page calling the backend `/api/health`.
- `src/auth/` — MSAL config + provider + login button. *(present only if Microsoft auth was scaffolded)*
````

---

### 3.5 Frontend — MSAL files **[MSAL only]**

Write these only when `auth=msal`, and use these variants of `main.tsx` / `App.tsx`.

**`<slug>-frontend/src/auth/msalConfig.ts`** **[MSAL only]**

````typescript
import { type Configuration, LogLevel } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID ?? "";
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID ?? "";

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority:
      import.meta.env.VITE_AZURE_AUTHORITY ??
      `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI ?? window.location.origin
  },
  cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false },
  system: {
    loggerOptions: { logLevel: LogLevel.Warning, piiLoggingEnabled: false }
  }
};

export const loginRequest = {
  scopes: [import.meta.env.VITE_AZURE_API_SCOPE ?? "User.Read"]
};
````

**`<slug>-frontend/src/auth/LoginButton.tsx`** **[MSAL only]**

````typescript
import { useMsal } from "@azure/msal-react";
import { Button } from "@/components/ui/button";
import { loginRequest } from "./msalConfig";

export function LoginButton() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  if (account) {
    return (
      <Button variant="outline" onClick={() => instance.logoutPopup()}>
        Sign out ({account.name ?? account.username})
      </Button>
    );
  }

  return (
    <Button onClick={() => instance.loginPopup(loginRequest)}>
      Sign in with Microsoft
    </Button>
  );
}
````

**`<slug>-frontend/src/main.tsx`** **[MSAL variant — replaces the §3.4 one]**

````typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import App from "./App";
import { msalConfig } from "./auth/msalConfig";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.initialize().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>
  );
});
````

**`<slug>-frontend/src/App.tsx`** **[MSAL variant — replaces the §3.4 one]**

````typescript
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginButton } from "@/auth/LoginButton";

interface Health {
  status: string;
  db: string;
  time: string;
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Health>("/health")
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to reach API"));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold"><Display Name></h1>
        <LoginButton />
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Backend health</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {health && (
            <pre className="rounded-md bg-muted p-3 text-sm">{JSON.stringify(health, null, 2)}</pre>
          )}
          {!health && !error && <p className="text-sm text-muted-foreground">Checking…</p>}
          <Button onClick={() => window.location.reload()}>Refresh</Button>
        </CardContent>
      </Card>
    </main>
  );
}
````

---

## 4. Final step — git init, then signal done

After every file is written (and only the MSAL files if `auth=msal`):

1. Run `git init` in the current directory (the project root). Do **not** run
   `npm install` and do **not** start any dev server.
2. Make the initial commit so the project has a real `main` branch (a freshly
   `git init`'d repo with no commits shows no branch in DevEasy's cockpit). Run,
   in order, from the project root:
   - `git add -A`
   - `git -c user.name="DevEasy" -c user.email="noreply@deveasy.local" commit -m "chore: scaffold <Display Name> via DevEasy"`
     (the inline `-c` author makes the commit succeed even when no global git
     identity is configured)
   - `git branch -M main` (name the branch `main`)
3. Emit exactly one completion block as your final output:

````
```deveasy-done
{ "project": "<slug>", "summary": "<Display Name> scaffolded: <slug>-backend (Express+Knex+TS) and <slug>-frontend (React 19+Vite+Tailwind+shadcn). Microsoft auth: <yes (MSAL, env placeholders) | no>. Defaults: npm, backend PORT 4000, frontend 5173, PostgreSQL via DATABASE_URL. git initialized. Next: run npm install in each package, then npm run dev." }
```
````

Set `Microsoft auth:` to `yes (MSAL, env placeholders)` or `no` based on the
answer, and confirm in the summary that **no secrets were written** — only
`.env.example` placeholders.

---

## 5. Checklist (self-verify before `deveasy-done`)

- [ ] Asked Q1 (name) and Q2 (auth) one per turn via `deveasy-question`, waited for each answer.
- [ ] Never called `AskUserQuestion`; never demanded a command prefix.
- [ ] Slug is `[a-z0-9-]` only; folders are `<slug>-backend/` and `<slug>-frontend/`.
- [ ] Root `README.md` + `.gitignore` written.
- [ ] Backend: package.json, tsconfig, eslint, `.env.example`, knexfile, `src/server.ts` (health route + configurable PORT), model + service + controller + routes.
- [ ] Frontend: package.json, vite/tsconfig/eslint/postcss/tailwind config, `index.html`, `src/main.tsx`, `src/App.tsx`, UI primitives, `.env.example`.
- [ ] If `auth=msal`: backend `@azure/msal-node` config + JWT verify + protected route; frontend `@azure/msal-browser` config + provider + login button; both READMEs mention auth; `.env.example` has `AZURE_*` / `VITE_AZURE_*` placeholders. If `auth=none`: none of these written and no MSAL deps in package.json.
- [ ] No real secrets/tenant/client IDs anywhere — placeholders only.
- [ ] `git init` + initial commit on `main` (via `git add -A` then a `-c`-authored commit); no `npm install`, no dev server.
- [ ] Emitted exactly one `deveasy-done` block last.
