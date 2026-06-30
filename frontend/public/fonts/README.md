# Bundled terminal fonts

The terminal (TERMINAL tab) uses the `--font-terminal` stack (`src/index.css`):

1. **Comic Code Ligatures** (`ComicCodeLigatures-*.otf`) — primary face.
2. **MesloLGL Nerd Font** (`MesloLGLNerdFont-*.ttf`) — fallback that supplies the
   powerline / git glyphs Comic Code doesn't have (browsers fall back per-glyph).
3. JetBrains Mono / system mono — last resort.

All files are served from `/fonts/...` at runtime, so a missing file just falls
back instead of breaking the build.

> **Note:** Comic Code is a commercial font, committed here per project request
> for a private, local-first app. If this repo ever goes public, remove the
> `ComicCodeLigatures-*.otf` files (and the matching `@font-face` blocks) — the
> terminal will fall back to Meslo.

## Swapping a font

Drop the file(s) here and update the `@font-face` blocks + `--font-terminal`
token in `src/index.css`. Inter-letter density is tuned via the xterm
`letterSpacing` option in `src/hooks/useTerminalSocket.ts`.
