# Bundled terminal font — MesloLGL Nerd Font

The terminal (TERMINAL tab) uses **MesloLGL Nerd Font** via the `--font-terminal`
token (`src/index.css`). The font files are bundled here and served from
`/fonts/...` at runtime:

```
MesloLGLNerdFont-Regular.ttf
MesloLGLNerdFont-Bold.ttf
MesloLGLNerdFont-Italic.ttf
MesloLGLNerdFont-BoldItalic.ttf
```

It's a Nerd Font, so it includes the powerline / git glyphs that prompts (p10k,
starship, etc.) render — no more missing-glyph boxes.

## Swapping the terminal font

1. Drop the new `.ttf`/`.woff2` files in this folder.
2. Update the `@font-face` blocks + `--font-terminal` token in `src/index.css`.

Files here live in `public/` on purpose: the URLs resolve at runtime, so a
missing file falls back to the mono stack instead of breaking the build.
