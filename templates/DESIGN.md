---
name: GV Mobility Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#40474f'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#707881'
  outline-variant: '#c0c7d1'
  surface-tint: '#006399'
  primary: '#00507d'
  on-primary: '#ffffff'
  primary-container: '#0369a1'
  on-primary-container: '#cbe4ff'
  inverse-primary: '#94ccff'
  secondary: '#525f75'
  on-secondary: '#ffffff'
  secondary-container: '#d6e3fe'
  on-secondary-container: '#58657b'
  tertiary: '#00573a'
  on-tertiary: '#ffffff'
  tertiary-container: '#00724e'
  on-tertiary-container: '#6dfabc'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cde5ff'
  primary-fixed-dim: '#94ccff'
  on-primary-fixed: '#001d32'
  on-primary-fixed-variant: '#004b74'
  secondary-fixed: '#d6e3fe'
  secondary-fixed-dim: '#bac7e1'
  on-secondary-fixed: '#0e1c2f'
  on-secondary-fixed-variant: '#3a475c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: '0'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: '0'
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-compact: 0.75rem
  margin: 2rem
  margin-compact: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style
This design system defines the digital desktop experience for enterprise mobility, corporate transport, and real-time fleet logistics management. Tailored for operational controllers, logistics directors, and corporate administrators, the interface projects dependability, precision, operational clarity, and forward momentum.

The design movement adheres to **Corporate / Modern High-Utility SaaS**:
- **Clarity over ornamentation:** Interfaces are streamlined to process dense telemetry data, trip allocations, driver manifests, and route schedules without cognitive fatigue.
- **Architectural Authority:** Deep corporate navy acts as the structural foundation for top-level navigation, primary anchors, and critical frames.
- **High-legibility Accents:** Precise oceanic blues drive immediate operational actions, while systematic emerald greens provide positive reassurance for active assets and validated dispatches.
- **Micro-Precision Iconography:** Exclusively vector SVG iconography with consistent stroke weights (1.5px to 2px); no conversational emojis or casual metaphors are permitted anywhere within production UI.

## Colors
The palette is built to withstand mission-critical dispatch environments with extended operational hours. The default mode is light, backed by calm slate tones that suppress glare while maintaining optimal contrast across layered panels.

### Palette Roles
- **Primary (`#0369A1` / Corporate Ocean Blue):** The primary interaction color for critical interactive elements, actionable buttons, table row selections, focused input states, and active route lines. Hover states transition to `#0284C7`.
- **Secondary (`#0B192C` / Deep Maritime Slate):** Serves as structural scaffolding. Used for desktop global headers, persistent sidebar navigation, primary typography headings, and modal backdrops.
- **Tertiary (`#10B981` / Precision Emerald):** Semantic status indicator strictly reserved for operational success, live vehicles in transit, verified corporate compliance, and positive telemetry deltas.
- **Neutral Palette (`#0F172A` to `#F8FAFC`):**
  - **App Canvas / Page Background:** `#F8FAFC` (Slate 50) and `#F1F5F9` (Slate 100) for structural splitters.
  - **Card / Surface Canvas:** `#FFFFFF` (Pure White) with crisp perimeter definition.
  - **Subtle Borders:** `#E2E8F0` (Slate 200) for high-precision division and `#F1F5F9` (Slate 100) for inner row delimiters.
  - **Text Neutral Primary:** `#0F172A` (Slate 900) for maximum legibility.
  - **Text Neutral Muted:** `#64748B` (Slate 500) for metadata, labels, and table column headers.
  - **Operational Warning & Destructive:** `#F59E0B` (Amber 500) for maintenance delays and `#EF4444` (Rose 500) for fleet alerts or critical trip cancellations.

## Typography
The system uses **Plus Jakarta Sans** across all desktop layers. Its geometric foundation with balanced apertures ensures immediate character recognition at dense data scales (such as live license plates, vehicle VINs, ETA timestamps, and multi-stop tables).

- **Data Tables & Numeric Displays:** Use tabular lining figures (`font-variant-numeric: tabular-nums`) across all timestamps, speed logs, unit identifiers, and currency tallies to ensure strict vertical column alignment.
- **Section Headers & Metric Counters:** Set bold weights (`700`) with tight letter tracking (`-0.02em`) to deliver confident visual hierarchy without occupying unnecessary vertical canvas.
- **Data Labels & Column Heads:** Capitalize or apply uppercase style with `label-sm` and `0.05em` letter spacing to demarcate secondary metadata from live operational values.

## Layout & Spacing
The layout architecture is constructed for wide-format desktop productivity (1440px+ native base, scalable from 1280px minimum viewports).

### Grid Architecture
- **Desktop Grid:** 12-column fluid flex grid configured with `1.25rem` (20px) gutters and `2rem` (32px) margins.
- **Operational Console Layout:** A 3-zone master workspace:
  1. **Primary Global Bar (Top):** Fixed 64px height (`#0B192C`) carrying identity, quick dispatch actions, global search, and account controls.
  2. **Telemetry / Navigation Rail (Left):** Collapsible 72px to 260px drawer for fleet operational views, manifests, maintenance, and reports.
  3. **Multi-pane Stage (Main Canvas):** Split view allowing simultaneous 60/40 rendering between interactive map telematics and dynamic data grids/manifest forms.

### Internal Spacing Rhythm
- Element padding and stacked form field gaps follow an 8pt base grid (`0.5rem` / `1rem` / `1.5rem`).
- Compact tabular grids utilize dense micro-paddings (`0.375rem` vertical, `0.75rem` horizontal) to display up to 20 units above the fold.

## Elevation & Depth
Elevation is achieved using a combination of **low-contrast architectural outlines** and **diffused ambient shadows**. This prevents visual clutter in screens packed with dense operational tables and map viewports.

### Depth Hierarchy
- **Level 0 (Base Canvas):** `#F8FAFC`. Completely flat; no elevation.
- **Level 1 (Operational Cards & Data Surfaces):** Pure White (`#FFFFFF`) with a 1px solid border in `#E2E8F0` and an ultra-subtle ambient shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`.
- **Level 2 (Hovered Cards, Dropdowns & Action Popovers):** Pure White (`#FFFFFF`) with border `#CBD5E1` and shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modals, Dispatch Side-Sheets & Map Overlay Controls):** Pure White (`#FFFFFF`) backed by a 24% `#0B192C` tinted backdrop blur (`backdrop-filter: blur(4px)`). Shadow: `0 20px 25px -5px rgba(11, 25, 44, 0.12), 0 8px 10px -6px rgba(11, 25, 44, 0.08)`.

## Shapes
The system implements a **Soft (`1`)** shape language (`0.25rem` / 4px base radius) to maintain an authoritative, structured, and enterprise-grade posture. 

- **Inputs, Checkboxes, Buttons, and Select Menus:** Strict 6px (`0.375rem`) corner radiuses, communicating reliable mechanical precision.
- **Cards, Panels, and Data Table Containers:** 8px (`0.5rem`) outer container radiuses to group content neatly without wasting corner pixels.
- **Status Badges & Live Unit Pills:** Full pill radiuses (`9999px`) to immediately separate qualitative metadata tags from actionable square-cornered buttons.

## Components

### Buttons
- **Primary Button:** Background `#0369A1`, text `#FFFFFF`, font-weight 600, border radius 6px. Hover state deepens to `#0284C7` with a subtle elevation shift. Active state targets `#075985`. Focus ring: 2px solid `#0369A1` with 2px offset in `#F8FAFC`.
- **Secondary Button:** Background `#FFFFFF`, text `#0B192C`, 1px solid border `#E2E8F0`. Hover state switches to `#F8FAFC` with border `#CBD5E1`.
- **Ghost / Tertiary Action:** Background transparent, text `#0369A1`. Hover background `#F0F9FF`.
- **Icon Alignment:** SVGs must be fixed at 16x16px or 18x18px with `margin-right: 8px`. No textual abbreviations.

### Status Chips & Badges
- **Active / En Route / Verified:** Background `#ECFDF5`, border `1px solid #A7F3D0`, text `#065F46`. Accompanied by a 6px pulsating `#10B981` status dot.
- **Pending / In Staging:** Background `#FFFBEB`, border `1px solid #FDE68A`, text `#92400E`.
- **Alert / Inactive:** Background `#FEF2F2`, border `1px solid #FECACA`, text `#991B1B`.
- **Corporate Fleet Meta:** Background `#F1F5F9`, border `1px solid #E2E8F0`, text `#334155`.

### Form Controls & Enterprise Inputs
- **Text Inputs & Select Menus:** 38px standard height, white background, border `1px solid #CBD5E1`, text `#0F172A`. Inner left SVG icons rendered in `#64748B`. Focused state applies `border-color: #0369A1` and a delicate box-shadow ring `0 0 0 3px rgba(3, 105, 161, 0.15)`.
- **Checkboxes & Radios:** 16x16px boxes, rounded 4px (checkbox) or circular (radio), border `1.5px solid #94A3B8`. Selected fill `#0369A1` with crisp white checkmark SVG.

### Fleet Telematics & Data Cards
- **Stat Cards (KPI Metrics):** `#FFFFFF` surface, `1px solid #E2E8F0`, 16px internal padding. Top row houses small uppercase label (`#64748B`) and categorized mini-icon. Center features 28px bold metrics with integrated directional trends (e.g., +4.2% in `#10B981`).
- **Fleet Grid Tables:** Clean alternating row options, sticky header with background `#F8FAFC`, uppercase column titles in `#64748B`, row height 44px for high density and rapid scanning. Selected or highlighted vehicle row transitions to `#F0F9FF` with a 3px left indicator border in `#0369A1`.

### Dispatch & Fleet Control Panels
- **Telemetry Popovers (Map Viewport):** Floating white cards pinned to vehicle nodes. Minimalistic header displaying vehicle ID, driver assigned, battery/fuel meter, and two immediate actions: "Ver Ruta" (Ghost) and "Contactar Unidad" (Primary Small).