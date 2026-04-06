# GATeR — Design system (Stitch MCP, authoritative)

**Project:** `11940742516565365524` — *Pipeline Deep Dive*  
**Last synced:** 2026-04-02 via Stitch MCP: `get_project`, `list_design_systems`, `fetch_screen_code`  
**Design system asset:** `assets/ce0962ed48f64c1eb3745224ab7fe7cc` — display name **GATeR Obsidian**

This file consolidates **API-returned tokens** (`designTheme.namedColors`, overrides, enums) and **verbatim** `designMd` / Workspace HTML patterns. Use with `tailwind.config.js` + `globals.css`.

---

## 1. Project & screen inventory (Stitch `list_screens`)

| Screen ID | Title |
|-----------|--------|
| `007b0af1d8e14f93a3fabd06798c4480` | Pipeline Deep Dive |
| `e4e639dbacf3443cb80db536a672c00c` | Landing Page |
| `f8392340720a469cb944211c9fac7ea3` | Workspace Dashboard |
| `1c1c09567db14e808d96748bba31c9bf` | Test Repair View |
| `f4c8da3312714034ab88ee4239785620` | Knowledge Graph Visualization |
| `f463096b4d6048989c9ccdaf046570c7` | Knowledge Graph - Cluster View |
| `ade1a70de8e44ec69174e3aa18ea125c` | Repository Analysis |
| `3a1d8792207e4578b275313fd8a4703d` | Vector Search Retrieval |
| `f427898ce83c44e1886e137df7ec87ca` | KGCompass Search |
| `7e08675e25ad450ab87d13d74d8f0854` | KUZU DB Performance |
| `79e779870a344d769ec7f6aa99fd8a1e` | Export & PR Integration |

---

## 2. Theme metadata (`designTheme`)

| Field | Value |
|--------|--------|
| Color mode | `DARK` |
| Color variant | `FIDELITY` |
| Custom / seed color | `#00E5FF` |
| Override primary | `#00E5FF` |
| Override secondary | `#7C4DFF` |
| Override tertiary | `#FFC107` |
| Override neutral | `#050506` |
| Roundness | `ROUND_EIGHT` → **8px** primary UI (`rounded-lg` in Tailwind extend) |
| Spacing scale | `3` → **spacious** (Stitch: 0 minimal … 3 spacious) |
| Headline font | `PLUS_JAKARTA_SANS` |
| Body font | `INTER` |
| Label font | `INTER` |

---

## 3. Color palette — all hex codes (`namedColors` from MCP)

| Token | Hex |
|--------|-----|
| `background` | `#131315` |
| `surface` | `#131315` |
| `surface_dim` | `#131315` |
| `surface_bright` | `#3a393a` |
| `surface_container_lowest` | `#0e0e0f` |
| `surface_container_low` | `#1c1b1d` |
| `surface_container` | `#201f21` |
| `surface_container_high` | `#2a2a2b` |
| `surface_container_highest` | `#353436` |
| `surface_variant` | `#353436` |
| `surface_tint` | `#00daf3` |
| `primary` | `#c3f5ff` |
| `primary_container` | `#00e5ff` |
| `primary_fixed` | `#9cf0ff` |
| `primary_fixed_dim` | `#00daf3` |
| `on_primary` | `#00363d` |
| `on_primary_container` | `#00626e` |
| `on_primary_fixed` | `#001f24` |
| `on_primary_fixed_variant` | `#004f58` |
| `inverse_primary` | `#006875` |
| `secondary` | `#cdbdff` |
| `secondary_container` | `#5203d5` |
| `secondary_fixed` | `#e8deff` |
| `secondary_fixed_dim` | `#cdbdff` |
| `on_secondary` | `#370096` |
| `on_secondary_container` | `#c0acff` |
| `on_secondary_fixed` | `#20005f` |
| `on_secondary_fixed_variant` | `#4f00d0` |
| `tertiary` | `#ffebc6` |
| `tertiary_container` | `#ffc948` |
| `tertiary_fixed` | `#ffdf9e` |
| `tertiary_fixed_dim` | `#fabd00` |
| `on_tertiary` | `#3f2e00` |
| `on_tertiary_container` | `#725400` |
| `on_tertiary_fixed` | `#261a00` |
| `on_tertiary_fixed_variant` | `#5b4300` |
| `on_background` | `#e5e1e3` |
| `on_surface` | `#e5e1e3` |
| `on_surface_variant` | `#bac9cc` |
| `outline` | `#849396` |
| `outline_variant` | `#3b494c` |
| `inverse_surface` | `#e5e1e3` |
| `inverse_on_surface` | `#313032` |
| `error` | `#ffb4ab` |
| `error_container` | `#93000a` |
| `on_error` | `#690005` |
| `on_error_container` | `#ffdad6` |

**Rule:** Do not use pure `#FFFFFF` for body text; use **`on_surface`** (`#e5e1e3`).

---

## 4. Typography

### 4.1 Font families (load in app)

| Role | Family | Weights (typical) |
|------|--------|-------------------|
| Headline / display | Plus Jakarta Sans | 400–800 |
| Body / label | Inter | 300–600 |
| Mono / code | JetBrains Mono | 400, 500 |

Google Fonts link used in Stitch HTML:

`https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap`

Tailwind `fontFamily` keys (from exports):

- `font-headline` → Plus Jakarta Sans  
- `font-body` / `font-label` → Inter  
- `font-mono` → JetBrains Mono  

### 4.2 Type scale (from `designMd`)

| Token | Size | Letter-spacing | Usage |
|--------|------|----------------|--------|
| `display-lg` | **3.5rem** (56px) | **-0.02em** | Hero / major headlines |
| `title-sm` | **1rem** (16px) | default | Nav labels, section titles |
| `body-md` | **0.875rem** (14px) | default | Body copy |
| `label-md` | 0.75–0.875rem | — | Form labels (`on_surface_variant`) |

Material Symbols (Stitch): Outlined, base ~20px, `FILL` 0, weight 300–400 in various screens.

---

## 5. Spacing

**Stitch `spacingScale`:** `3` (spacious).

| Token / use | Rem | Px (16 root) | Notes |
|-------------|-----|----------------|--------|
| `3` | **1rem** | 16 | List/card vertical rhythm |
| `4` | **1.4rem** | 22.4 | Larger stack gaps |
| `24` | **8.5rem** | 136 | Major section breaks (“editorial”) |

**Layout constants (Workspace / marketing HTML):**

- Main content padding: `p-8` → **32px**  
- Page sections: `space-y-8` / `gap-6` / `gap-12` as in screen exports  
- Pipeline page: `main` uses `pt-32 pb-24 px-6 md:px-12`; sticky TOC `top-32`  

---

## 6. Border radius (`tailwind.config` extend from Stitch HTML)

| Key | Value |
|-----|--------|
| `DEFAULT` | `0.25rem` (4px) |
| `lg` | `0.5rem` (8px) |
| `xl` | `0.75rem` (12px) |
| `full` | `9999px` |

Primary cards / buttons: **`rounded-lg`** (8px) unless a control uses `rounded` (4px) or `rounded-xl` (12px).

---

## 7. Component styles (from `designMd`)

### 7.1 Buttons

- **Primary:** Gradient `primary` → `primary_container`, text `on_primary`, no border, `rounded-lg`, hover ~opacity 0.9. *(Some Stitch screens use solid `bg-primary` + `text-on-primary` for emphasis buttons.)*  
- **Secondary / ghost:** Transparent or `surface_container_low`, border `outline_variant` ~20%, text `primary`.  
- **Tertiary:** Text `primary`, hover background `surface_container_low`.

### 7.2 Inputs

- Background: `surface_container_low`  
- Border: `outline_variant` ~20%; focus: primary.  
- Labels: `label-md`, `on_surface_variant`.

### 7.3 Cards & lists

- Background: `surface_container_lowest` or `surface_container_low`  
- Border: `outline_variant` ~10%  
- No hard divider lines between rows; use spacing tokens **3** / **4**  
- Hover: `surface_container_high`

### 7.4 Glass panel (Stitch HTML export)

```css
.glass-panel {
  background: rgba(53, 52, 54, 0.6);
  backdrop-filter: blur(16px);
}
```

### 7.5 Code blocks

- Background: `surface_container_lowest`  
- Font: JetBrains Mono  
- Border: ghost `outline_variant` (low opacity)

### 7.6 Status beacon

- **8px** circle, `primary` (active) or `error` (failed); optional glow with `surface_tint`.

---

## 8. Shadows & elevation

- Depth via **tonal layering** (surface tokens), not heavy shadows on static cards.  
- **Active nav glow:** `box-shadow: 0 0 15px rgba(195, 245, 255, 0.1);`  
- **Status dot:** `box-shadow: 0 0 8px rgba(195, 245, 255, 0.6);`  
- **Floating FAB:** `shadow-2xl`  
- **Ambient (modals):** black ~20% opacity, ~32px blur  

---

## 9. Navbar & footer (marketing screens)

- Nav height **64px** (`h-16`), `bg-surface` / `#131315` in exports, horizontal padding **32px** (`px-8`).  
- Footer: `bg-[#131315]`, `border-t border-[#e5e1e3]/10`, uppercase tracking, `text-[#e5e1e3]/40` for muted links.

---

## 10. Verbatim `designMd` (Kinetic Precision Framework)

The following is the **exact** `designMd` string returned by Stitch for this project’s theme.

---

# Design System Document: The Kinetic Precision Framework

## 1. Overview & Creative North Star: "The Digital Architect"
This design system is built for the high-stakes world of deep-tech development. It moves away from the "generic SaaS" aesthetic by embracing a Creative North Star we call **The Digital Architect**.

The goal is to evoke the feeling of a high-end physical workstation—precise, heavy, and intentionally structured. We break the "template" look through **intentional asymmetry** and **tonal depth**. Instead of centering everything, we use "weighted layouts" where technical data is anchored to a strict grid, while interactive elements float with generous breathing room. We lean into high-contrast typography scales to ensure that even the most complex technical data feels like a curated editorial piece rather than a cluttered spreadsheet.

---

## 2. Colors: Tonal Architecture
The palette is rooted in a "void" of near-blacks, utilizing electric accents to guide the developer’s eye through complex logic.

### Core Palette (Material Design Mapping)
- **Background & Surfaces:** `surface` (#131315) and `surface_container_lowest` (#0e0e0f) form our foundation.
- **Accents:** `primary` (#c3f5ff) provides the electric "cyan" energy for main actions, while `secondary` (#cdbdff) introduces a sophisticated violet for secondary logic paths.
- **Data Highlights:** `tertiary` (#ffebc6) acts as our amber highlight for warnings or specialized data nodes.

### The "No-Line" Rule
Standard 1px solid borders are prohibited for layout sectioning. We define boundaries through **Background Shifts**.
*Example:* A sidebar should not be separated by a line; instead, use `surface_container_low` for the sidebar against a `surface` main content area. This creates a "molded" look rather than a "sketched" look.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers.
- **Base Layer:** `surface` (The desk).
- **Secondary Workspaces:** `surface_container` (The layout blocks).
- **Interactive Nodes:** `surface_container_highest` (The active cards/modals).
Nesting must follow a logical darkening or lightening flow. An inner container should always use a higher-tier surface (e.g., `surface_container_high` inside a `surface_container_low` section) to imply physical elevation.

### The "Glass & Gradient" Rule
To avoid a flat, "cheap" feel, main CTAs and Hero sections must utilize subtle gradients transitioning from `primary` to `primary_container`. For floating panels, use **Glassmorphism**:
- **Fill:** `surface_variant` at 60% opacity.
- **Effect:** 12px-20px Backdrop Blur.
- **Result:** The "Cyber-Frosted" effect.

---

## 3. Typography: Technical Authority
We use a high-contrast pairing to balance brutalist technicality with premium readability.

- **Display & Headlines:** **Plus Jakarta Sans** (Mapping Geist/Satoshi intent). Use `display-lg` (3.5rem) for high-impact moments. These should have tight letter spacing (-0.02em) to feel "locked in."
- **Titles & UI Labels:** **Inter**. This is our workhorse. Use `title-sm` (1rem) for most navigation and sub-headers to maintain a professional, neutral tone.
- **Body:** **Inter**. `body-md` (0.875rem) is the standard for documentation and descriptions.
- **Technical/Code:** **JetBrains Mono** (mapped to system mono). Used for all data strings, hashes, and code snippets.

---

## 4. Elevation & Depth: Tonal Layering
We reject the "Shadow-First" mentality. Depth is achieved via **Tonal Layering**.

- **The Layering Principle:** Place a `surface_container_lowest` card on a `surface_container_low` background. This creates a "sunken" or "raised" effect purely through value contrast.
- **Ambient Shadows:** Shadows are reserved for floating elements (Modals, Popovers). Use a shadow color tinted with `primary` (e.g., `#000000` at 20% opacity with a 32px blur) to mimic the glow of a screen rather than a physical object.
- **The "Ghost Border" Fallback:** When a border is essential for accessibility, use `outline_variant` at **15% opacity**. A 100% opaque border is considered a design failure in this system. It must look like a "hint" of a line, barely catching the light.

---

## 5. Components: Precision Primitives

### Buttons
- **Primary:** Gradient fill (`primary` to `primary_container`), `on_primary` text. No border.
- **Secondary:** Transparent background, `ghost border` (#outline_variant at 20%), `primary` text.
- **Tertiary:** Pure text with `primary` color, shifts to `surface_container_low` on hover.
- **Corner Radius:** Hard-coded to `DEFAULT` (0.5rem / 8px) for a sharp, engineered feel.

### Input Fields
- **Background:** `surface_container_low`.
- **Border:** `outline_variant` at 20%.
- **Active State:** Border opacity increases to 100% using the `primary` color.
- **Typography:** Labels use `label-md` in `on_surface_variant`.

### Cards & Lists
- **Rule:** Forbid divider lines.
- **Separation:** Use `3` (1rem) or `4` (1.4rem) spacing tokens to create vertical rhythm.
- **Hover:** Transition background to `surface_container_high`.

### Deep-Tech Additions
- **The "Status Beacon":** A small 8px circle using `primary` (Active) or `error` (Failed) with a `surface_tint` outer glow.
- **The "Code Block":** Always uses `surface_container_lowest`, JetBrains Mono, and a 1px `ghost border`.

---

## 6. Do’s and Don’ts

### Do
- **Do** use `24` (8.5rem) spacing for major section breaks to create an "Editorial" feel.
- **Do** align all technical data to a strict grid using `JetBrains Mono`.
- **Do** use `surface_bright` sparingly to highlight the most important interactive focal point.

### Don’t
- **Don't** use pure white (#FFFFFF) for text. Always use `on_surface` (#e5e1e3) to reduce eye strain in dark environments.
- **Don't** use standard shadows for cards. If it doesn't float, it doesn't get a shadow. Use tonal shifts instead.
- **Don't** use 1px solid borders at 100% opacity. It breaks the "molded" aesthetic and introduces visual noise.

---

*End of Stitch `designMd`.*

---

## 11. DTCG note

The design-system asset may expose `designTokens` (DTCG JSON). If empty in MCP responses, rely on **`namedColors`** above and **HTML exports** (`fetch_screen_code`) for Tailwind `theme.extend` blocks.

---

## 12. Revision

Re-fetch Stitch MCP after major theme or screen changes: project `11940742516565365524`.
