# GATeR — Stitch design system (strict)

**Source of truth:** Google Stitch project `11940742516565365524` (“Pipeline Deep Dive”), fetched via Stitch MCP:

- `get_project` → `projects/11940742516565365524` (`designTheme`)
- `list_design_systems` → asset `assets/ce0962ed48f64c1eb3745224ab7fe7cc`, display name **GATeR Obsidian**
- `fetch_screen_code` → screen `f8392340720a469cb944211c9fac7ea3` (**Workspace Dashboard**) for the **exact** Tailwind `theme.extend` block and layout measurements

**DTCG note:** The design-system asset did **not** return a non-empty `designTokens` (DTCG JSON) field in MCP responses. Token values below are the **complete** set returned by Stitch APIs plus **verbatim** values from the generated Workspace HTML.

**Goal:** Implement the Next.js UI using these values so visuals match Stitch exports. Prefer a single `tailwind.config` extension that mirrors the Workspace HTML `tailwind.config` colors and `fontFamily` keys.

---

## 1. Theme metadata (Stitch)

| Field | Value |
|--------|--------|
| Display name | **GATeR Obsidian** |
| Color mode | `DARK` |
| Color variant | `FIDELITY` |
| Seed / custom color | `#00E5FF` |
| Override primary | `#00E5FF` |
| Override secondary | `#7C4DFF` |
| Override tertiary | `#FFC107` |
| Override neutral | `#050506` |
| Roundness enum | `ROUND_EIGHT` → **8px** default radius for primary UI (see §5) |
| Spacing scale | `3` → **spacious** (Stitch: 0 minimal … 3 spacious) |
| Headline font (enum) | `PLUS_JAKARTA_SANS` |
| Body / label font (enum) | `INTER` |

---

## 2. Colors — exact hex (Material roles)

Use these names in Tailwind/CSS variables to match Stitch exports.

### 2.1 Core surfaces

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

### 2.2 Primary (cyan)

| Token | Hex |
|--------|-----|
| `primary` | `#c3f5ff` |
| `primary_container` | `#00e5ff` |
| `primary_fixed` | `#9cf0ff` |
| `primary_fixed_dim` | `#00daf3` |
| `on_primary` | `#00363d` |
| `on_primary_container` | `#00626e` |
| `on_primary_fixed` | `#001f24` |
| `on_primary_fixed_variant` | `#004f58` |
| `inverse_primary` | `#006875` |

### 2.3 Secondary (violet)

| Token | Hex |
|--------|-----|
| `secondary` | `#cdbdff` |
| `secondary_container` | `#5203d5` |
| `secondary_fixed` | `#e8deff` |
| `secondary_fixed_dim` | `#cdbdff` |
| `on_secondary` | `#370096` |
| `on_secondary_container` | `#c0acff` |
| `on_secondary_fixed` | `#20005f` |
| `on_secondary_fixed_variant` | `#4f00d0` |

### 2.4 Tertiary (amber)

| Token | Hex |
|--------|-----|
| `tertiary` | `#ffebc6` |
| `tertiary_container` | `#ffc948` |
| `tertiary_fixed` | `#ffdf9e` |
| `tertiary_fixed_dim` | `#fabd00` |
| `on_tertiary` | `#3f2e00` |
| `on_tertiary_container` | `#725400` |
| `on_tertiary_fixed` | `#261a00` |
| `on_tertiary_fixed_variant` | `#5b4300` |

### 2.5 Content / outline / inverse

| Token | Hex |
|--------|-----|
| `on_background` | `#e5e1e3` |
| `on_surface` | `#e5e1e3` |
| `on_surface_variant` | `#bac9cc` |
| `outline` | `#849396` |
| `outline_variant` | `#3b494c` |
| `inverse_surface` | `#e5e1e3` |
| `inverse_on_surface` | `#313032` |

### 2.6 Error

| Token | Hex |
|--------|-----|
| `error` | `#ffb4ab` |
| `error_container` | `#93000a` |
| `on_error` | `#690005` |
| `on_error_container` | `#ffdad6` |

**Rule (from Stitch `designMd`):** Do **not** use pure `#FFFFFF` for body text; primary text is **`on_surface`** (`#e5e1e3`).

---

## 3. Typography

### 3.1 Font families (load these)

| Role | Family | Weights (from Stitch HTML) |
|------|--------|----------------------------|
| Headline / display | **Plus Jakarta Sans** | 400, 500, 600, 700, 800 |
| Body / UI / label | **Inter** | 300, 400, 500, 600 |
| Mono / data / code | **JetBrains Mono** | 400, 500 |

Google Fonts link used in Stitch Workspace HTML:

`https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap`

Tailwind `fontFamily` keys from Workspace export:

- `font-headline` → Plus Jakarta Sans  
- `font-body` / `font-inter` → Inter  
- `font-mono` → JetBrains Mono  

### 3.2 Type scale (from Stitch `designMd` — strict)

| Token | Size | Letter-spacing | Usage |
|--------|------|----------------|--------|
| `display-lg` | **3.5rem** (56px) | **-0.02em** | Hero / major headlines |
| `title-sm` | **1rem** (16px) | default | Nav labels, section titles |
| `body-md` | **0.875rem** (14px) | default | Body copy, descriptions |
| `label-md` | match body or 0.75–0.875rem | — | Form labels (`on_surface_variant`) |

Workspace HTML examples (follow for density):

- Sidebar product title: `text-[#c3f5ff] font-bold font-headline tracking-tighter leading-none`
- Sub-label: `text-[10px] text-on-surface-variant/60 uppercase tracking-widest`
- Page H2: `text-3xl font-headline font-extrabold tracking-tight text-on-surface`
- Status bar mono: `text-[11px] font-mono text-primary/80 uppercase tracking-tighter`
- Micro caps: `text-[10px] text-on-surface-variant/50 uppercase`

---

## 4. Spacing system

**Stitch `spacingScale`: `3` (spacious).**

From `designMd` (authoritative rhythm):

| Token | Rem | Px (16 root) | Use |
|--------|-----|----------------|-----|
| `3` | **1rem** | 16 | List/card vertical rhythm |
| `4` | **1.4rem** | 22.4 | Larger stack gaps |
| `24` | **8.5rem** | 136 | Major section breaks (“editorial”) |

**Layout constants from Workspace HTML:**

- Main content: `p-8` → **32px** page padding  
- Sidebar: `py-6`, horizontal `px-6` on blocks  
- Bento grid: `gap-6` → **24px**  
- Section vertical: `space-y-8` → **32px** between blocks  

---

## 5. Border radius

**Stitch enum:** `ROUND_EIGHT` → **8px** engineered default for buttons/cards (`0.5rem`).

**Workspace HTML `tailwind.config` extension:**

| Key | Value |
|-----|--------|
| `DEFAULT` | `0.25rem` (4px) |
| `lg` | `0.5rem` (8px) |
| `xl` | `0.75rem` (12px) |
| `full` | `9999px` |

Apply **8px** (`rounded-lg` in that config) for primary cards and primary buttons unless a component explicitly uses `rounded` (4px) or `rounded-xl` (12px).

---

## 6. Shadows and elevation

**Philosophy (Stitch):** Depth is **tonal layering** (surface tokens), not heavy shadows on static cards.

### 6.1 Allowed shadows (from exports)

| Name | Definition |
|------|------------|
| **Active nav glow** | `box-shadow: 0 0 15px rgba(195, 245, 255, 0.1);` (class `active-tab-glow` in Workspace HTML) |
| **Status dot** | `box-shadow: 0 0 8px rgba(195, 245, 255, 0.6);` (inline on status beacon) |
| **Floating FAB** | `shadow-2xl` (Tailwind) on primary circular button |
| **Ambient (modals / float)** | From `designMd`: `#000000` at **20%** opacity, **32px** blur, optionally tinted toward primary for “screen glow” |

### 6.2 Glass panel (floating / secondary surfaces)

From Workspace HTML:

```css
.glass-panel {
  background: rgba(53, 52, 54, 0.6);
  backdrop-filter: blur(12px);
}
```

`designMd` also allows **12px–20px** backdrop blur and `surface_variant` at ~60% opacity for glass.

### 6.3 Borders

- Prefer **no** 1px layout borders; separate regions by **background** (`surface_container_low` vs `surface`).
- When required: **`outline_variant` at 10–20% opacity** (e.g. `border-outline-variant/10`, `/15`, `/20` in Tailwind).
- Ghost border for accessibility: **`outline_variant` ~15%** (never full-strength dividers for layout).

---

## 7. Component styles (match Stitch)

### 7.1 Buttons

| Variant | Style |
|---------|--------|
| **Primary** | Linear gradient **`primary` → `primary_container`**, text **`on_primary`**, **no border**, radius **8px** (`rounded-lg`), hover **opacity ~0.9** |
| **Secondary / ghost** | Transparent or `surface_container_low`, border **`outline_variant` ~20%**, text **`primary`** |
| **Tertiary** | Text **`primary`**, hover background **`surface_container_low`** |
| **Destructive emphasis** | Use **`error`** / **`on_error`** tokens for alerts |

### 7.2 Inputs

- Background: **`surface_container_low`**
- Border: **`outline_variant` @ ~20%**; focus: **primary** solid border
- Labels: **`label-md`**, color **`on_surface_variant`**

### 7.3 Cards & lists

- Background: **`surface_container_lowest`** or **`surface_container_low`**
- Border: **`outline_variant` @ 10%** typical (`border-outline-variant/10`)
- Radius: **8px** (`rounded-lg`)
- **No** divider lines between rows; use **spacing 3 / 4** only
- Hover: background → **`surface_container_high`**

### 7.4 Code blocks

- Background: **`surface_container_lowest`**
- Font: **JetBrains Mono**
- Border: 1px **ghost** `outline_variant` (low opacity)

### 7.5 Status beacon

- **8px** circle, fill **`primary`** (active) or **`error`** (failed)
- Optional outer glow using **`surface_tint`**

---

## 8. Navbar (top status bar) — Workspace HTML

| Property | Value |
|----------|--------|
| Height | **64px** (`h-16`) |
| Background | **`#0e0e0f`** (`surface_container_lowest`) |
| Bottom border | **`outline_variant` @ 5%** (`border-outline-variant/5`) |
| Horizontal padding | **32px** (`px-8`) |
| Position | **sticky** `top-0`, `z-40` |

Content pattern: status pill (2px dot + mono label), vertical **1px** separators at **20%** `outline_variant`, optional CMD+K chip (`surface_container_low` + `outline_variant/20` border).

---

## 9. Sidebar — Workspace HTML

| Property | Value |
|----------|--------|
| Width | **256px** (`w-64`) |
| Position | **fixed** `left-0 top-0`, full height |
| Background | **`#0e0e0f`** (`surface_container_lowest`) |
| Right border | **`outline_variant` @ 15%** (`border-outline-variant/15`) |
| Vertical padding | **24px** (`py-6`) |
| Nav item | `px-6 py-3`, inactive text **`on_surface` @ 60%** |
| **Active item** | Text **`#c3f5ff`**, **left border 2px** `primary`, background **`#131315`**, class **`active-tab-glow`** |
| Icons | Material Symbols Outlined, **20px**, weight **300**, `FILL` 0 |

---

## 10. Tailwind — canonical `theme.extend` (colors + fonts + radius)

Copy **exact** `colors` and `fontFamily` from the Workspace `fetch_screen_code` `<script id="tailwind-config">` block (section 2 table matches that object). Keep **kebab-case** keys as in HTML: `on-surface`, `primary-container`, etc.

---

## 11. Optional: Material icons

Stitch Workspace uses **Material Symbols Outlined**:

`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap`

Base class:

```css
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
  font-size: 20px;
}
```

---

## 12. Full Stitch design markdown (verbatim)

The following is **exactly** the `designMd` string returned by Stitch for this project (Kinetic Precision Framework). Use it for qualitative rules; **hex values** in §2 override if anything conflicts.

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

**Revision:** Generated from Stitch MCP + Workspace HTML export. Re-fetch project `11940742516565365524` after major Stitch edits to keep this file synchronized.
