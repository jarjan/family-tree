# 🌳 Family Tree (Shezhire)

An interactive, web-based family tree (Shezhire) visualization tool built with Astro, Preact, and D3.js.

## 🚀 Overview

This project provides a dynamic and responsive visualization of family lineages, specifically designed for Kazakh Shezhire but extensible to any family tree structure. It features a dual-language interface (English and Kazakh) and an interactive tree canvas.

## 🛠 Tech Stack

- **Framework:** [Astro](https://astro.build/)
- **UI Library:** [Preact](https://preactjs.com/)
- **Visualization:** [D3-hierarchy](https://github.com/d3/d3-hierarchy)
- **Styling:** Vanilla CSS (with Glassmorphism effects)
- **Data Management:** Node.js (`scripts/compile.js`)

## ✨ Features

- **Relative-Centric View:** Dynamic visualization that clusters all immediate relatives (parents, grandparents, siblings, cousins, children, grandchildren) around a selected person.
- **Bi-lingual Support:** Toggle between English (EN) and Kazakh (KK), with Kazakh as the default.
- **Detail Panel:** Navigate through the family by clicking on relatives in the panel.
- **Ultra-Compact UI:** Optimized for viewing large family circles efficiently.
- **Glassmorphic UI:** Modern and clean aesthetic.

## 📁 Project Structure

```text
/
├── src/
│   ├── components/    # Preact components (TreeCanvas, DetailPanel, etc.)
│   ├── data/          # JSON data source (family.json)
│   ├── locales/       # Translation dictionaries (en.json, kk.json)
│   ├── pages/         # Astro pages (entry point)
│   ├── utils/         # i18n and helper functions
│   └── styles/        # Global CSS
├── scripts/
│   ├── compile.js     # Script for compiling family.txt to family.json
├── family.txt         # Indented family tree text representation (source of truth)
└── astro.config.mjs   # Astro configuration (base path, integrations)
```

## ⚙️ Setup & Development

### Prerequisites

- **Node.js:** `>=24.0.0` (as specified in `package.json`)

### Installation

```sh
npm install
```

### Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts local dev server at `localhost:4321/family-tree/` (auto-compiles `family.txt`) |
| `npm run build` | Builds the production site to `./dist/` (auto-compiles `family.txt`) |
| `npm run preview` | Previews the production build locally |
| `npm test` | Runs the test suite |

## 📊 Data Structure

The family tree data is stored in `src/data/family.json`. Each member is an object with the following potential fields:

- `id`: Unique identifier (readable slug).
- `name`: First name.
- `lastName`: Last name.
- `fatherId`: ID of the father.
- `motherId`: ID of the mother.
- `spouseOf`: ID of the spouse.
- `gender`: `male` or `female`.
- `birthday`: `YYYY-MM-DD`.
- `notes`: Additional biographical details.

### Data Compilation

To edit the family tree data:
1. Open and modify [family.txt](file:///Users/jarjan/Desktop/dev/family-tree/family.txt) (the source of truth).
2. Compile your changes to JSON:
   ```sh
   node scripts/compile.js
   ```
   *(Note: `npm run dev` and `npm run build` automatically compile `family.txt` as well)*

## 🚀 Deployment

The project is configured for deployment to GitHub Pages at `https://jarjan.github.io/family-tree/`. The deployment workflow is automated via GitHub Actions (`.github/workflows/deploy.yml`).
