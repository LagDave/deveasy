# Bundled terminal font — Comic Code (Ligatures)

The terminal (TERMINAL tab) uses **Comic Code Ligatures** via the `--font-terminal`
token (`src/index.css`). Comic Code is a commercial font, so its files are not
checked in. Drop your licensed `.woff2` files here with these exact names:

```
frontend/public/fonts/ComicCodeLigatures-Regular.woff2
frontend/public/fonts/ComicCodeLigatures-Bold.woff2
```

That's it — no rebuild config needed. These are served from `/fonts/...` at
runtime, and the `@font-face` rules in `src/index.css` already point at them.
Until the files are present, the terminal falls back to JetBrains Mono.

If you only have `.ttf`/`.otf`, convert to `woff2` (e.g. `npx ttf2woff2` or
fontsquirrel) for smaller payloads, or add the original format to the `src:`
list in the `@font-face` blocks.
