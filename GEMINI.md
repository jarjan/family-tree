# Project Instructions: Family Tree (Shezhire)

This document provides foundational mandates and architectural guidance for the Family Tree project.

## 🏗 Architecture & Frameworks

- **Hybrid Framework:** We use **Astro** for the project structure and static generation, with **Preact** for interactive UI components.
- **Visualization:** **D3-hierarchy** is the core engine for tree calculations. Always prefer D3's hierarchical layout logic over manual coordinate math.
- **Styling:** Use **Vanilla CSS**. Follow the "Glassmorphism" aesthetic established in `src/styles/global.css` and component-specific CSS files (e.g., using `backdrop-filter: blur()`, semi-transparent backgrounds, and thin borders).

## 🌐 Internationalization (i18n)

- **Utility:** All user-facing strings must be routed through `src/utils/i18n.js` using the `t()` function.
- **Supported Languages:** `en` (English) and `kk` (Kazakh).
- **Adding Strings:** When adding new UI text, update the `translations` object in `src/utils/i18n.js` for both languages.

## 📊 Data Management & Schema

- **Source of Truth:** `src/data/family.json` is the flat-array source of truth for all family members.
- **Schema Constraints:**
    - `id`, `fatherId`, and `motherId` are the primary keys for tree construction.
    - Relationships like `spouseOf` are handled as cross-references within the flat list.
- **Data Integrity:** After manually editing `family.json`, always consider if `migrate.py` needs to be run to ensure UUID consistency or to update relationships.

## 🛠 Workflows

- **Component Structure:** Keep Preact components in `src/components/`. Pair each `.jsx` file with a corresponding `.css` file in the same directory.
- **Tree Visualization:** The `TreeCanvas.jsx` component manages the relative-centric layout and SVG rendering. It dynamically builds a "family circle" around the selected member, showing ancestors, descendants, siblings, and cousins.
- **Deployment:** The project is deployed to a subpath (`/family-tree/`). Always ensure `base: '/family-tree'` in `astro.config.mjs` is respected when adding links or asset paths.

## 🎨 Design Principles

- **Focus:** The application should prioritize the "focused node" (the selected family member).
- **Interactivity:** Every node should be interactive. Smooth transitions between selection states are preferred.
- **Elegance:** Maintain a clean, minimal, and modern look, suitable for genealogical research.
