# Refined Tactility Design System

> A "2.5D" design language for ChessVermouth — clean, modern, and tactile.

---

## 1. Color Palette (Dark Mode Focus)

### Core Colors

| Role                  | Hex       | Name          | Rationale                                                                                                                                                                                                 |
| --------------------- | --------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Background Deep**   | `#0D0D12` | Obsidian      | A near-black with a subtle blue undertone. Avoids the harshness of pure `#000000`, reducing eye strain while creating depth. The slight warmth prevents the UI from feeling cold or clinical.             |
| **Surface Primary**   | `#1A1A24` | Slate Depth   | Used for cards, menus, and floating panels. Noticeably lighter than the background to create clear elevation hierarchy without harsh contrast.                                                            |
| **Surface Secondary** | `#252532` | Charcoal Mist | For nested elements, input fields, and secondary containers. Provides a third layer in the visual hierarchy.                                                                                              |
| **Accent Primary**    | `#C9A227` | Antique Gold  | A sophisticated, muted gold that evokes luxury and the timeless nature of chess. Used sparingly for primary actions and highlighting the best move on the board. Not overly bright — refined, not flashy. |
| **Accent Secondary**  | `#3D5A80` | Deep Sapphire | A complementary cool accent for secondary selections, links, and hover states. Balances the warmth of gold.                                                                                               |

### Semantic Colors

| Role        | Hex       | Name          | Usage                                                                                                 |
| ----------- | --------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| **Success** | `#2E7D5A` | Forest Jade   | Correct moves, puzzle completion, positive feedback. Muted green that feels premium, not neon.        |
| **Error**   | `#A63D40` | Burgundy Rose | Blunders, invalid moves, errors. A deep, sophisticated red that commands attention without screaming. |
| **Warning** | `#D4883A` | Amber Caution | Time pressure indicators, caution states. Warm without being alarming.                                |

### Text Colors

| Role               | Hex       | Opacity | Usage                           |
| ------------------ | --------- | ------- | ------------------------------- |
| **Text Primary**   | `#EAEAF0` | 100%    | Headlines, primary content      |
| **Text Secondary** | `#A0A0B0` | 100%    | Subheadings, less critical info |
| **Text Muted**     | `#6B6B7A` | 100%    | Captions, timestamps, hints     |

---

## 2. Typography System

### Font Family

**Primary:** [**Inter**](https://fonts.google.com/specimen/Inter)

> **Rationale:** Inter is a geometric sans-serif designed specifically for screens. Its high x-height and open apertures ensure exceptional legibility at small sizes — critical for chess notation and UI labels. The variable font weight axis provides precise typographic control.

**Fallback Stack:**

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Type Scale

| Level        | Size | Weight         | Line Height | Letter Spacing | Usage                         |
| ------------ | ---- | -------------- | ----------- | -------------- | ----------------------------- |
| **H1**       | 28pt | Bold (700)     | 1.2         | -0.02em        | Screen titles, "Game Over"    |
| **H2**       | 20pt | SemiBold (600) | 1.3         | -0.01em        | Section headers, player names |
| **Body 1**   | 16pt | Regular (400)  | 1.5         | 0              | General content, explanations |
| **Body 2**   | 14pt | Regular (400)  | 1.5         | 0              | Secondary content, settings   |
| **Caption**  | 12pt | Medium (500)   | 1.4         | 0.02em         | Notation, labels, timestamps  |
| **Overline** | 10pt | SemiBold (600) | 1.3         | 0.08em         | Category labels (uppercase)   |

### Typography CSS Variables

```css
:root {
  --font-h1: 700 28px/1.2 'Inter', sans-serif;
  --font-h2: 600 20px/1.3 'Inter', sans-serif;
  --font-body1: 400 16px/1.5 'Inter', sans-serif;
  --font-body2: 400 14px/1.5 'Inter', sans-serif;
  --font-caption: 500 12px/1.4 'Inter', sans-serif;
  --font-overline: 600 10px/1.3 'Inter', sans-serif;
}
```

---

## 3. "Tactile" Component Rules

### 3.1 Primary Button

The primary button embodies "Refined Tactility" through subtle depth cues that make it feel pressable without being skeuomorphic.

#### Default State

```css
.btn-primary {
  /* Base */
  background: linear-gradient(180deg, #d4ad2e 0%, #b8922a 100%);
  color: #0d0d12;

  /* Tactile depth - subtle top highlight */
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);

  /* Rounded but not childish */
  border-radius: 12px;

  /* Soft shadow for lift */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);

  /* Typography */
  font: var(--font-body1);
  font-weight: 600;
  padding: 14px 28px;

  /* Smooth interactions */
  transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
```

#### Hover State

```css
.btn-primary:hover {
  background: linear-gradient(180deg, #e0b830 0%, #c9a227 100%);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5), 0 3px 6px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}
```

#### Pressed State

```css
.btn-primary:active {
  background: linear-gradient(180deg, #b8922a 0%, #a68424 100%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(0, 0, 0, 0.2);
  transform: translateY(1px);
}
```

#### Tactility Breakdown

| Property                 | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| **Vertical Gradient**    | Creates the illusion of a curved, lit surface                      |
| **Differential Borders** | Top/left lighter (light source), bottom/right darker (shadow edge) |
| **Layered Shadows**      | Soft ambient + harder contact shadow = realistic depth             |
| **Inset Highlight**      | Subtle internal glow reinforces convex shape                       |
| **Transform on Press**   | Physical feedback — button "sinks" into the surface                |

---

### 3.2 Cards & Modals (Glassmorphism)

For overlays like the game-end screen, we apply modern glassmorphism — a frosted glass effect that maintains context awareness while creating a clear visual layer.

#### Modal / Overlay Card

```css
.modal-glass {
  /* Frosted Glass Effect */
  background: rgba(26, 26, 36, 0.75);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);

  /* Subtle luminous border */
  border: 1px solid rgba(255, 255, 255, 0.08);

  /* Premium rounded corners */
  border-radius: 20px;

  /* Elevation shadow */
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5), 0 12px 24px rgba(0, 0, 0, 0.3),
    inset 0 0 0 1px rgba(255, 255, 255, 0.03);

  /* Smooth entry animation */
  animation: modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

#### Glassmorphism Parameters

| Parameter              | Value                          | Rationale                                                                     |
| ---------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| **Background Opacity** | 75% (`rgba(26, 26, 36, 0.75)`) | Enough translucency to hint at content beneath, opaque enough for readability |
| **Blur Radius**        | 24px                           | Smooth, creamy blur that softens background without being muddy               |
| **Border Opacity**     | 8% white                       | Barely visible edge that catches light and defines the glass edge             |
| **Inner Glow**         | 3% white 1px inset             | Very subtle internal luminosity that adds material quality                    |

#### Scrim (Background Overlay)

```css
.modal-scrim {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  animation: fadeIn 0.25s ease-out;
}
```

---

## 4. Elevation & Shadow System

Shadows in "Refined Tactility" are soft, diffused, and layered. They never have harsh edges.

### Shadow Tokens

#### Floating Low

**Use for:** Standard UI elements resting on the background — navigation bars, floating action buttons, tool panels.

```css
--shadow-floating-low: 0 4px 12px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.15);
```

| Layer   | Offset Y | Blur | Opacity | Purpose                                  |
| ------- | -------- | ---- | ------- | ---------------------------------------- |
| Ambient | 4px      | 12px | 25%     | Soft, diffused ambient shadow            |
| Contact | 2px      | 4px  | 15%     | Smaller, sharper shadow near the surface |

---

#### Floating High

**Use for:** The chessboard itself — the most prominent, "heaviest" element on screen. Also for critical modals.

```css
--shadow-floating-high: 0 16px 48px rgba(0, 0, 0, 0.45), 0 8px 24px rgba(0, 0, 0, 0.3),
  0 4px 8px rgba(0, 0, 0, 0.2);
```

| Layer       | Offset Y | Blur | Opacity | Purpose                                           |
| ----------- | -------- | ---- | ------- | ------------------------------------------------- |
| Far Ambient | 16px     | 48px | 45%     | Deep, expansive shadow — creates significant lift |
| Mid Shadow  | 8px      | 24px | 30%     | Bridges far shadow and contact                    |
| Contact     | 4px      | 8px  | 20%     | Grounding shadow near the element                 |

---

### Visual Hierarchy via Elevation

```
┌─────────────────────────────────────────┐
│  LAYER 4: Modals & Dialogs              │  ← floating-high + glassmorphism
├─────────────────────────────────────────┤
│  LAYER 3: Chessboard                    │  ← floating-high (hero element)
├─────────────────────────────────────────┤
│  LAYER 2: Cards, Panels, FABs           │  ← floating-low
├─────────────────────────────────────────┤
│  LAYER 1: Input Fields, Dividers        │  ← no shadow, border only
├─────────────────────────────────────────┤
│  LAYER 0: Deep Background               │  ← #0D0D12 (Obsidian)
└─────────────────────────────────────────┘
```

---

## 5. Quick Reference: CSS Variables

```css
:root {
  /* Colors - Core */
  --color-bg-deep: #0d0d12;
  --color-surface-primary: #1a1a24;
  --color-surface-secondary: #252532;
  --color-accent-gold: #c9a227;
  --color-accent-sapphire: #3d5a80;

  /* Colors - Semantic */
  --color-success: #2e7d5a;
  --color-error: #a63d40;
  --color-warning: #d4883a;

  /* Colors - Text */
  --color-text-primary: #eaeaf0;
  --color-text-secondary: #a0a0b0;
  --color-text-muted: #6b6b7a;

  /* Shadows */
  --shadow-floating-low: 0 4px 12px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.15);
  --shadow-floating-high: 0 16px 48px rgba(0, 0, 0, 0.45), 0 8px 24px rgba(0, 0, 0, 0.3),
    0 4px 8px rgba(0, 0, 0, 0.2);

  /* Transitions */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-tactile: cubic-bezier(0.25, 0.46, 0.45, 0.94);

  /* Radii */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-xl: 28px;
}
```

---

## 6. Implementation Notes

1. **Backdrop Filter Support:** Test `backdrop-filter` on target platforms. For Safari, always include `-webkit-backdrop-filter`.

2. **Performance:** Limit blur effects to 2-3 simultaneous elements to maintain 60fps on mobile.

3. **Contrast Ratios:** All text/background combinations meet WCAG AA standards (4.5:1 for body text).

4. **Motion:** Use `prefers-reduced-motion` media query to respect user accessibility preferences.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

_Document Version: 1.0_  
_Design Language: Refined Tactility_  
_Last Updated: December 2024_
