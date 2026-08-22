# Person A — Design & UI Lead

> **⚠️ HISTORICAL DOCUMENT — does not describe the current build.**
>
> This was written during the original 24-hour build, when TiXPay ingested data by reading
> the device SMS inbox. That path has since been removed: the app now imports a bank
> statement the user picks through the system file picker, and `READ_SMS` is explicitly
> blocked in the manifest. The engine's analytical core (mandate discovery, shadow ledger,
> projection, guard, intercept) is unchanged and still described accurately here.
>
> Current documentation: [`README.md`](README.md) and
> [`packages/engine/README.md`](packages/engine/README.md).

---


**TiXPay UPI · 24h hackathon · React Native + Expo + TypeScript**

You own everything the judges see. You are not blocked by anyone after hour 1.

---

## 0. Your one job

The app presents as a **full UPI client** — onboarding, KYC, PIN, QR scan, pay — with the guard layer woven in. Two moments must be flawless:

> **1. The intercept.** User scans a QR for ₹8,000. Before confirming, a sheet fires: *"This leaves you ₹3,200 short on the 9th — your ₹5,000 SIP will bounce"* plus *"Pay with your Amex instead — ₹4,000 to your fee waiver."*
>
> **2. The resolution.** Curve dips red on day 12. Tap the dip. *"Pause Netflix ₹649 → your SIP survives."* One tap, curve morphs green, `₹250 avoided`.

Everything else — onboarding, home, cards, settings — is scaffolding that makes those two feel real. Build the scaffolding fast and plainly. Spend your polish here.

---

## 1. Rules of engagement

**Golden rule:** components are purely visual. Accept props, render, fire callbacks. No maths, no business logic, no `Date` arithmetic inside a component.

```tsx
// ✅ yours
function BalanceCurve({ curve, shortfalls, onDipPress }: Props) { ... }

// ❌ not yours — this belongs to Person B
function BalanceCurve({ transactions }: Props) {
  const curve = computeBalance(transactions);  // NO
}
```

**Never import from `packages/engine`.** You import *types* from the shared contract and nothing else. If you find yourself needing a calculation, that's a message to B, not a function you write.

```ts
import type { Mandate, BalanceCurve, Intervention } from '@tixpay/types';
```

**You work against `mocks.ts`, committed by Person C at hour 1.** It contains fully-populated fixtures for every interface, including one shortfall scenario. Build the entire UI against it. Integration at the end is C swapping a selector — if you've done this right, your components don't change at all.

If `mocks.ts` isn't in the repo by hour 1, say so loudly. Do not start inventing your own shapes.

---

## 2. Design tokens

Set these first, in one file. Do not improvise colours later at 3am.

```ts
export const t = {
  bg:        '#0A0C10',
  surface:   '#141820',
  surfaceHi: '#1D2330',
  border:    '#252C3A',

  text:      '#E8ECF2',
  textDim:   '#8792A6',
  textFaint: '#5A6478',

  danger:    '#F0553D',   // shortfall, penalty
  warn:      '#F5A524',   // approaching threshold
  ok:        '#2DD4A0',   // resolved, healthy
  accent:    '#5B8DEF',   // interactive
};

export const radius = { sm: 8, md: 14, lg: 22, sheet: 28 };
export const space  = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 };
```

**Two accents only: amber = warning, emerald = resolved.** Red is reserved exclusively for shortfall regions and penalty amounts. If red appears anywhere else it stops meaning anything.

**Typography:** Inter. Load via `expo-font`. Three sizes maximum per screen.

```ts
display: { fontSize: 34, fontWeight: '700', letterSpacing: -0.8 },
title:   { fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
body:    { fontSize: 15, fontWeight: '400' },
caption: { fontSize: 12, fontWeight: '500', color: t.textDim },
```

**All currency uses tabular figures.** Non-negotiable — without it, digits jitter horizontally during the curve animation and it looks broken.

```tsx
<Text style={{ fontVariant: ['tabular-nums'] }}>₹{amount.toLocaleString('en-IN')}</Text>
```

Build a `<Rupee amount={n} />` component in hour 1 and use it everywhere. Indian grouping (`en-IN` gives `₹1,23,456`) matters for authenticity with these judges.

---

## 2b. Onboarding — 90 minutes, hard cap

Pure theatre, zero logic. It buys the "this is a real UPI app" framing and nothing else. Judges do not score KYC screens. Build it plainly, get out.

| # | Screen | Content |
|---|---|---|
| 1 | Splash | Logo, one-line value prop, `Get started` |
| 2 | Mobile | Number field, fake OTP — **any 6 digits pass** |
| 3 | KYC | Name, PAN field, `Verifying…` spinner 1.5s → ✓ Verified |
| 4 | Bank discovery | "Found 2 accounts" — mock list, tap to select |
| 5 | UPI PIN | 4-dot entry — **see safety note below** |
| 6 | Add cards | Multi-select 2–3 from `cards.json` |
| 7 | SMS permission | ← the one real thing. Behind a button, never on mount. |
| 8 | Analysing | Progress animation over "Reading inbox → Finding mandates → Projecting" |

**Safety — non-negotiable.** The PIN screen must be obviously non-functional:
- Any 4 digits accepted, nothing stored, nothing validated
- Visible label on screen: `SIMULATED — this is not a real UPI PIN`

Never build UI that trains someone to type a real UPI PIN into a non-PSP app. This is the one place where "make it look real" is the wrong instinct.

**Build a dev toggle that skips to an active account.** Mandatory, not optional. You'll reset this demo forty times during rehearsal.

Screen 8 is the only one worth any polish — a progress animation naming the three engine stages is a free explanation of what the product does.

---

## 2c. Home screen

The UPI-app surface. Top to bottom:

1. **Balance card** — inferred balance, `display` size, small `inferred` caption
2. **Alert strip** — if a shortfall exists in the next 30 days: `⚠ ₹3,200 short on 12 Mar · 2 debits at risk` → taps through to Calendar. If clear, an emerald `All clear for 30 days`.
3. **Scan & Pay** — big primary CTA
4. **Mini curve** — 30-day sparkline, tappable → Calendar
5. **Recent activity** — last 5 transactions

The alert strip is doing the work here. It's the first thing on screen after onboarding and it proves the app knew something the moment it got SMS access.

---

## 2d. Payment flow

Modal stack from Home. Four steps.

### Scan

`expo-camera` with barcode scanning. **This is real, not simulated** — UPI QR codes are deep links carrying `pa`, `pn`, `am`, `mc` as plain query params, so you can scan an actual shop QR on stage and parse genuine merchant data. Protect this moment.

Include a `Enter VPA manually` fallback — venue lighting will be bad.

### Confirm

Payee name, VPA, amount field (editable if the QR had no `am`), instrument selector showing the added cards + bank account. `Pay` button.

### Verdict sheet — your headline screen

Renders a `PaymentVerdict` from Person B. Three states:

**`WARNING`** — red accent, blocking:
```
⚠  Hold on

   ₹8,000 to Croma

   This leaves you ₹3,200 short on 9 March
   Your ₹5,000 SIP will bounce · ₹250 charge

   ┌──────────────────────────────────┐
   │ 💳 Pay with Amex instead         │
   │    Keeps your balance intact     │
   │    + ₹4,000 to your fee waiver   │
   └──────────────────────────────────┘

   [ Use Amex ]        [ Pay anyway ]
```

**`ADVISORY`** — amber banner above the confirm button, non-blocking:
```
💳 Pay with Amex — ₹4,000 to your fee waiver
```

**`CLEAR`** — a small green tick near the amount. Nothing else.

Three rules:
- **`Pay anyway` is always present and always works.** A guard that blocks you is a guard you uninstall — and a judge will absolutely test this.
- **`CLEAR` must be near-invisible.** Most payments should feel frictionless or the product is nagware.
- Sheet must appear in under ~150ms after Pay. B's `evaluatePayment` returns in under 100ms; don't add an artificial delay for drama.

### Success

Simulated PIN entry (same fake component as onboarding) → checkmark → dismiss to Home. **Then the curve must visibly change.** Store writes the transaction, everything re-derives. If the user goes to Calendar, the shortfall has moved. That's the proof the loop is live.

---

## 3. Screen 1 — Cash-Flow Calendar (the hero)

Spend 40% of your time here.

### Layout, top to bottom

1. **Header** — "Next 30 days", current inferred balance in `display` size
2. **The curve** — full-bleed SVG, ~240px tall
3. **Scrubber readout** — date + projected balance, updates on drag
4. **Mandate strip** — horizontal scroll of upcoming debits as pills

### The curve

```tsx
interface BalanceCurveProps {
  curve: BalancePoint[];        // { date, balance, events }
  shortfalls: Shortfall[];
  onDipPress: (shortfall: Shortfall) => void;
  animateTo?: BalancePoint[];   // when set, morph to this
}
```

Build it with `d3-shape` generating the path string, `react-native-svg` rendering it:

```ts
import { line, area, curveMonotoneX } from 'd3-shape';
import { scaleLinear, scaleTime } from 'd3-scale';

const x = scaleTime().domain([start, end]).range([0, width]);
const y = scaleLinear().domain([min, max]).range([height, 0]);

const pathLine = line<BalancePoint>()
  .x(d => x(d.date)).y(d => y(d.balance)).curve(curveMonotoneX)(curve);
```

**Layers, back to front:**

1. Horizontal gridlines at `t.border`, 20% opacity
2. **Zero line** — dashed, `t.textFaint`. This is the reference the whole story hangs on; make it legible.
3. **Area fill below the curve** — emerald gradient where balance > 0
4. **Red region** — clip the area to `balance < 0` and fill `t.danger` at 30% opacity. Use `<Defs><ClipPath>`.
5. Curve stroke, 2.5px, `t.ok` normally
6. **Dip marker** — pulsing circle at the lowest shortfall point, `t.danger`, with a `₹` label. This is the tap target. Make it at least 44×44 in hit area even though it renders smaller.
7. Scrubber line + dot

### Animations

`react-native-reanimated` v3, `useSharedValue` + `useAnimatedProps`.

- **Entry:** curve draws left-to-right over 700ms via `strokeDasharray` / `strokeDashoffset`
- **Dip marker:** infinite pulse, `withRepeat(withSequence(...))`, scale 1 → 1.15, 1.2s
- **Resolution morph:** when `animateTo` changes, interpolate the path `d` over 600ms and cross-fade red region → emerald. Fire `Haptics.notificationAsync(Success)` at the start.

**On path morphing:** you cannot naively `interpolate` two SVG path strings. Ensure both curves have the **same number of points** (they will — both are 30 daily samples), then interpolate the *y values* and regenerate the path each frame inside `useDerivedValue`. Do it this way from the start; discovering it at hour 15 costs an hour.

### Scrubber

`react-native-gesture-handler` `Pan`. Snap to nearest day index. Show date + balance above the finger. Haptic tick (`selectionAsync`) on each day crossed — cheap, feels expensive.

---

## 4. Screen 2 — Intervention Bottom Sheet

`@gorhom/bottom-sheet`, snap points `['45%', '75%']`.

```tsx
interface InterventionSheetProps {
  shortfall: Shortfall | null;
  interventions: Intervention[];
  onSelect: (i: Intervention) => void;
  onDismiss: () => void;
}
```

### Content

**Header block** — the problem, stated plainly:
```
⚠  Shortfall on 12 March
   You'll be ₹3,200 short
   2 debits at risk
```

**At-risk list** — each mandate with its priority colour and amount. The SIP and the EMI should look visually heavier than the OTT.

**Intervention cards** — 2–3, stacked, ranked:

```
┌─────────────────────────────────┐
│  Pause Netflix          ₹649    │
│  ─────────────────────────────  │
│  ✓ Saves your ₹5,000 SIP        │
│  ₹250 penalty avoided           │  ← emerald, prominent
│                    [ Do this ]  │
└─────────────────────────────────┘
```

`penaltyAvoided` is the number judges remember. Give it emerald and at least `title` size.

**On tap:** dismiss the sheet, fire `onSelect`, let the parent hand a new `animateTo` to the curve. Success haptic. Do not show a confirmation dialog — the whole pitch is *one tap*.

---

## 5. Screen 3 — Mandate Hub

```tsx
interface MandateHubProps {
  mandates: Mandate[];
  onMandatePress: (m: Mandate) => void;
}
```

Sectioned by priority: `CRITICAL` → `HIGH` → `MEDIUM` → `LOW`.

### Row anatomy

```
┌──────────────────────────────────────────┐
│ [icon]  Netflix                  ₹649    │
│         Monthly · next 15 Mar            │
│         ●●●○ 82%   found from 6 SMS  ⌄   │
└──────────────────────────────────────────┘
```

- **Confidence badge** — four dots filled proportionally, or a small bar. Colour: `ok` above 80%, `warn` 60–80%, `textDim` below.
- **Provenance** — `found from {occurrences} SMS`. This phrase is doing real persuasive work; don't shorten it to a number.
- **Expand** — reveals the source SMS bodies, **redacted** (§7). This is the "prove it" affordance and a judge will ask for it.

Add a header stat: *"8 auto-debits discovered · ₹14,200/month · no bank login"*. That last clause is the pitch in four words.

---

## 6. Screen 4 — Simulator dashboard

Hidden tab. Utilitarian — this is stage equipment, not product. Do not spend polish time here beyond legibility from 3 metres.

**World Clock** — a horizontal date slider. Large date readout. Everything downstream recomputes as it moves.

**Scenario presets** — three big buttons: `Healthy` · `Tight month` · `Bounce imminent`. Judges will ask "what if"; you tap.

**SMS injector** — three buttons that push a synthetic message: `[Salary credited]` `[SIP debited]` `[Autopay FAILED]`. Show a toast when one lands so the audience sees cause and effect.

**Fake GPay checkout** — this is the one part worth designing properly, because feature 5 has no other moment:
- Merchant chips: Swiggy · BigBasket · Croma · Landlord
- Amount field, big numeric
- Pay button
- **On tap, a banner slides in:** `Don't use UPI here — swipe your Amex. You're ₹4,000 from your fee waiver.`

That banner is a `Recommendation` object rendered. Props only.

---

## 7. Redaction layer — you own this

A real SMS inbox will be on a projector in front of strangers, probably recorded.

Build a render-path masking utility around hour 16. **Render path, not data path** — the engine keeps real values, only display masks.

```ts
export const redact = {
  vpa:  (v: string) => on ? v.slice(0,2) + '****@' + v.split('@')[1] : v,
  tail: (t: string) => on ? '••' + t.slice(-4) : t,
  smsBody: (b: string) => on ? maskDigitsExceptAmount(b) : b,
};
```

Rules:
- VPAs → `sw****@ybl`
- Account tails → `••4471`
- Amounts → **real**, they're the point
- Salary credit → render as "Income event", never the figure
- **Any SMS where `isFinancial === false` is never rendered at all**, redaction on or off

Ship with redaction **ON** by default. Toggle in Settings.

---

## 8. Hour plan

| Hour | Do |
|---|---|
| 0–1 | Tokens, `<Rupee>`, fonts, tab shell, screen skeletons |
| 1–2 | Mandate Hub against `mocks.ts` — badges, provenance |
| 2–4 | **Balance curve** — SVG layers, scales, entry animation |
| 4–7 | Curve scrubber + intervention sheet + morph animation |
| 7–9 | **Onboarding, all 8 screens.** Timebox hard. Dev skip toggle. |
| 9–10 | Home screen — balance card, alert strip, mini curve |
| 10–13 | **Payment flow** — scan, confirm, **verdict sheet**, success |
| 13–15 | Cards screen (MTD spend, cap/waiver progress bars) |
| 15–17 | Simulator dashboard — utilitarian, legible from 3m |
| 17–19 | **Redaction layer**, empty states, loading states, polish |
| 19–21 | Bug support for C's integration |
| 21+ | Freeze |

**If you fall behind, cut in this order:** Cards screen → simulator polish → onboarding screens 3 and 4 → recent activity on Home. Never cut the verdict sheet or the curve morph.

---

## 9. Traps

- **Do not use a chart library.** Victory / Gifted Charts will fight you on the red-clip region and the morph. 60 lines of d3 path maths is less work than one API argument you can't win.
- **Empty states, early.** C will hand you real data that returns zero mandates at some point. A blank white screen on stage is worse than a bug.
- **Test on the actual demo device by hour 8**, not the emulator. Reanimated performance and SVG rendering differ, and the device may have a notch or a 120Hz panel that changes your timing.
- **Don't animate on the JS thread.** Everything through `useAnimatedProps` / `useAnimatedStyle`, or the curve morph will stutter at exactly the wrong moment.
- **Hit areas.** The dip marker renders ~12px. Its touch target must be 44px. Judges tap imprecisely on someone else's phone.