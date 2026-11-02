<div align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="" />
  <h1>Synthex</h1>
  <p>Karnaugh map and boolean expression minimizer</p>
</div>

## Features

- Truth table (1-8 variables), KMap (1-5 variables)
- Minimal SOP and POS via Quine-McCluskey, with don't cares
- Group highlighting, truth table and timing diagram
- 3D view of how the map wraps: cylinder for 3 variables, torus for 4, two tori for 5
- Load a text-based expression
- Works offline (PWA)

## Expression syntax

- OR: `+` or `|`
- AND: `*`, `.`, `&`, or nothing (`x1x2`)
- NOT: `x1'`, `!x1` or `~x1`
- Parentheses and the constants `0` and `1`

## Running locally

```sh
npm install
npm run dev
```

## Built with

- React and TypeScript on Vite
- Tailwind CSS, shadcn/ui on Radix UI, and Lucide icons
- KaTeX for the math
- Three.js through React Three Fiber and drei for the 3D view
- vite-plugin-pwa for offline use
