# Family Tree (Shezhire): agent guide

An interactive family tree (Kazakh *shezhire*) built with **Astro** (static site) and
**Preact** (interactive UI), published on GitHub Pages at
https://jarjan.github.io/family-tree/. `CLAUDE.md` and `GEMINI.md` are symlinks to this file.

## Commands

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Dev server at http://localhost:4321/family-tree/ (compiles `family.txt` first) |
| `npm run build` | Production build into `dist/` (compiles `family.txt` first) |
| `npm test` | `node --test tests/*.test.js` |
| `node scripts/compile.js` | Compiles `family.txt` into `src/data/family.json` |
| `node scripts/generate-icons.js` | Regenerates the favicons and app icons in `public/` (uses `sharp`, which comes with Astro) |

Node.js `>=24` is required (`package.json` `engines`).

## Where things live

- `family.txt`: the family data, the source of truth.
- `src/data/family.json`: generated from `family.txt`. Never edit it by hand, but do commit it with every `family.txt` change (the app imports it).
- `scripts/compile.js`: parser and validator for `family.txt`.
- `src/utils/relations.js`: `getRelatives()` works out everyone related to the selected person.
- `src/utils/layout.js`: `computeLayout()` turns those relatives into card positions and links (a pure function).
- `src/utils/person.js`: display helpers `fullName`, `getInitials`, and `cx` (joins class names).
- `src/utils/i18n.js`, `src/locales/{en,kk}.json`: UI strings.
- `src/utils/storage.js`: `readStorage`/`writeStorage`; use these instead of `localStorage` directly (it can throw).
- `src/components/`: Preact components, each `.jsx` paired with a `.css` file of the same name.
- `src/pages/index.astro`: the single page; also registers the service worker.
- `public/sw.js`: offline service worker. Bump `CACHE_NAME` whenever its caching rules or precache list change.
- `research/`: local research notes, scans and photos. It is excluded through `.git/info/exclude` and never committed.

## Editing the family data

Each line of `family.txt` is one person:

```text
- Name [key: value, key: value] (spouse: Name [key: value])
```

- **Indentation** makes a person the child of the nearest less-indented line above, which sets their `fatherId` (a `fatherId:` attribute only applies to unindented, top-level lines).
- Lines starting with `#` and blank lines are ignored. Every other line must start with `-`.
- **Attributes:** `id`, `lastName`, `gender` (`male`/`female`; no gender is shown as male), `birthday` (`YYYY`, `YYYY-MM` or `YYYY-MM-DD`), `motherId`, `fatherId`, `spouseOf`, `notes`. A value runs until the next `, key:`, so notes may contain commas but not `]`.
- **Ids** are slugs with Kazakh Cyrillic transliterated to Latin: `name-fathername` for a person (just `name` at the top level), `name-<husband's id>` for an inline spouse, with `-2`, `-3`... added on collisions. Give an explicit `id:` only when the generated one is unsuitable. Renaming a person changes their id, and renaming a father changes his children's ids too, which breaks shared links (`#id` in the URL) and any `spouseOf`/`motherId` pointing at them. The compiler reports those as dangling ids.
- **Spouses:** an inline `(spouse: Name [...])` creates a woman (unless `gender:` says otherwise) married to that person. A wife who has her own ancestry in the tree is instead listed under her father with `gender: female, spouseOf: <husband's id>`.
- **Mothers:** a child's `motherId` is filled in only when the father has exactly one wife; with several wives, set `motherId:` on each child.
- **Other parentheses** stay part of the displayed name, e.g. `Наурызәлі (Сартабан)` for an alias.
- The compiler stops the build on duplicate or dangling ids, self-references, bad `gender`/`birthday` values and ancestry cycles.

When adding research findings, treat a search result as a lead, not a fact: add a person or link only once a source shows it, and cite it at the end of `notes` (`Дерек: tumalas.kz.`). Notes are written in Kazakh. The repository is public, so leave out details about living people that shouldn't be on the website.

## How the app works

1. `TreeApp.jsx` holds the selected person and language. The selection is kept in the URL hash (`#zharzhan-serik`), so views can be linked and the back button returns to earlier people. With no hash it falls back to the person named «Жаржан».
2. `getRelatives()` resolves the selected person's relatives once; both `TreeCanvas` (via `computeLayout()`) and `DetailPanel` use the result.
3. `TreeCanvas.jsx` draws the cards and links, and handles pan, zoom and pinch with Pointer Events. The pan/zoom values are written straight to CSS variables on the canvas layer, not stored in state, so gestures never re-render the tree.
4. Changing the selection runs a View Transition: each card has its own `view-transition-name`, so cards glide to their new positions. Browsers without the API just update.
5. `OnboardingModal.jsx` is a native `<dialog>` shown once per browser (remembered in `localStorage`).

Keep relationship and layout logic in `relations.js` and `layout.js`, not in components, so it stays testable.

## Conventions

- **Strings:** every user-facing string goes through i18n: `const t = useT()` in components, `translate(lang, key)` elsewhere. Add each new key to both `en.json` and `kk.json` (a test checks they match). Kazakh (`kk`) is the default language.
- **Styling:** plain CSS with the existing glassmorphism look (`.glass`: translucent background, `backdrop-filter: blur()`, thin borders). Shared tokens and the `.btn` base live in `src/styles/global.css`, which loads *after* component CSS; when a component refines `.btn`, use a compound selector such as `.btn.close-btn` instead of `!important`.
- **Motion:** spatial movement (slides, scaling, hover lift) goes inside `@media (prefers-reduced-motion: no-preference)`; colour fades can stay.
- **Mobile:** use `dvh` rather than `vh`, and keep edge-anchored UI clear of notches with `env(safe-area-inset-*)`.
- **Base path:** the site is served under `/family-tree` (`base` in `astro.config.mjs`); include it in every link and asset URL.

## Tests and deployment

- `tests/compile.test.js`: parsing, ids, validation, and that the committed `family.json` is valid (so recompile before testing data changes).
- `tests/relations.test.js`: relatives, including several wives, half-siblings and cycles.
- `tests/layout.test.js`: for **every** person in `family.json`, no overlapping cards, each person rendered once, and links that join rendered cards.
- `tests/i18n.test.js`: defaults, fallbacks and matching keys between languages.

Every push to `main` runs the tests and then builds and **deploys to production** (`.github/workflows/deploy.yml`). Run `npm test` and `npm run build` before pushing.

## Design principles

- The selected person is the focus; everything is arranged around them.
- Every card is interactive, and changes of selection should feel smooth.
- Keep the look clean, minimal and modern, suited to genealogical research.
