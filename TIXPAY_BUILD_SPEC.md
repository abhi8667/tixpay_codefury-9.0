# TiXPay UPI — Build Spec

**24h hackathon · 3 builders · React Native + Expo + TypeScript · Concept prototype, not shipping**

---

## 0. TL;DR for the team

We are building an **on-device, zero-integration cash-flow guard for UPI users**. It reads the phone's SMS inbox, discovers recurring auto-debits without any bank API, projects a forward balance curve, and warns the user *before* a debit bounces — then offers one-tap interventions.

**The demo moment we are optimising for:** a balance curve dips below zero on day 12. User taps the dip. Sheet offers "Pause Netflix ₹649 → your ₹5,000 SIP survives." One tap. Curve re-animates flat and green. `₹250 penalty avoided`.

Everything in this document serves that 8-second moment.

### What is IN

| # | Feature | Logic | UI | Wiring |
|---|---|---|---|---|
| 1 | Mandate Hub (SMS → recurring debits) | B | A | C |
| 2 | Cash-Flow Calendar (forward balance curve) | B | A | C |
| 3 | Bounce Guard (shortfall + interventions) | B | A | C |
| 4 | Cause Attribution Engine | B | A | C |
| 5 | Card / instrument router | B | A | C |
| 6 | UPI simulator (demo harness) | B | A | C |

Roles in full at §10. The column split *is* the architecture: B never imports React, A never imports the engine, C owns the seam.

### What is OUT

- **Micro-Spend Aggregator** — roadmap slide only. It's a chart that changes no behaviour and competes for demo minutes.
- Any backend, any network call, any auth, any cloud. The app makes **zero HTTP requests**. This is a feature; say it on stage.

---

## 1. Known constraints — read before pitching

Do not let a judge discover these. Put them on a slide and own them.

### 1.1 Only RuPay credit cards work on UPI
Visa/Mastercard/Amex cannot be linked to UPI. So "best card for this UPI transaction" is a thin decision. **We reframe feature 5 as a payment-instrument router:** the valuable output is not "card A over card B," it's *"don't pay this ₹8,000 by UPI — swipe your Visa, you're ₹4,000 from the fee waiver."* We arbitrage across rails, not within one.

### 1.2 We cannot read the account balance
Balance requires a UPI PIN inside a licensed PSP app. Our `B_t` is a **shadow ledger** reconstructed from credit/debit SMS and reconciled whenever a message contains a balance hint. State this deliberately in the pitch: *"we maintain an inferred balance, reconciled on every SMS."*

### 1.3 MCC is not reliably available
The UPI deep-link spec carries an `mc` field, but small merchants' static QRs often omit it, and a non-PSP app can't observe the payment intent anyway. We use **VPA-string heuristics + a seed mapping table**, and every MCC resolution carries a confidence score. Never present it as certain.

### 1.4 The ₹250–500 bounce penalty is NACH/EMI, not UPI Autopay
A failed UPI Autopay for an OTT subscription usually costs the user nothing but a service pause. The real money is in **EMIs and NACH-registered SIPs**. Anchor the loss story there; OTT auto-pause is the *lever*, not the loss.

### 1.5 READ_SMS is Play-Store restricted
For non-default-SMS apps. Slide line: *"Production path is the RBI Account Aggregator framework or an on-device notification listener. SMS is the zero-integration prototype."* Judges reward knowing your own constraints.

---

## 2. Architecture

**One engine, two shells.** The analytics core is pure TypeScript with zero platform dependencies. The mobile app imports it; so does the simulator. Every rule is testable in milliseconds under `vitest` instead of by rebuilding an APK.

```
tixpay/
├─ packages/engine/                 # pure TS — no React, no Android
│   ├─ src/
│   │   ├─ parse/                   # SMS → Transaction[]
│   │   ├─ detect/                  # Transaction[] → Mandate[]
│   │   ├─ project/                 # ledger + mandates → BalanceCurve
│   │   ├─ guard/                   # BalanceCurve → Intervention[]
│   │   ├─ attribute/               # failed txn → cause
│   │   ├─ route/                   # merchant + cards → Recommendation
│   │   └─ types.ts
│   ├─ data/
│   │   ├─ cards.json
│   │   ├─ mcc_map.json
│   │   └─ vpa_patterns.json
│   ├─ fixtures/
│   │   ├─ sms_cases.json           # ~30 hand-labelled parse cases
│   │   ├─ real_inbox.json          # dumped once from the demo device
│   │   └─ demo_inbox.json          # generated synthetic scenario
│   ├─ scripts/
│   │   ├─ generate.ts              # synthetic SMS generator
│   │   └─ measure.ts               # parse-rate report
│   └─ test/                        # vitest
└─ apps/mobile/                     # Expo dev client → the APK
    ├─ app/                         # expo-router
    │   ├─ (tabs)/calendar.tsx
    │   ├─ (tabs)/mandates.tsx
    │   ├─ (tabs)/settings.tsx
    │   └─ (tabs)/simulator.tsx     # hidden tab
    ├─ components/
    ├─ store/                       # zustand
    └─ native/                      # SMS bridge + config plugin
```

Monorepo via **pnpm workspaces**. Do not over-engineer this — two packages, one `pnpm-workspace.yaml`.

---

## 3. Stack

### 3.1 App

| Layer | Choice | Note |
|---|---|---|
| Framework | Expo **dev client** (NOT Expo Go) | Expo Go cannot read SMS |
| Language | TypeScript, `strict: true` | |
| Navigation | `expo-router` | File-based tabs |
| State | `zustand` | One store. Redux is overkill here |
| Persistence | `react-native-mmkv` | Sync reads, no async ceremony |
| Styling | `nativewind` v4 | Tailwind classes |
| SMS | `react-native-get-sms-android` + Expo config plugin | Highest-risk dependency — prove it in hour 2 |
| Notifications | `expo-notifications` | Local only |
| Haptics | `expo-haptics` | Free polish on intervention tap |

### 3.2 UI / visualisation

| Need | Tool |
|---|---|
| Balance curve | `react-native-svg` + `d3-shape` |
| Animation | `react-native-reanimated` v3 |
| Gestures | `react-native-gesture-handler` |
| Bottom sheet | `@gorhom/bottom-sheet` |
| Icons | `lucide-react-native` |

**Do not use a chart library.** We need one chart with very specific behaviour (red fill below zero, draggable scrubber, re-animation on intervention). Fighting Victory/Gifted-Charts' API costs more than 60 lines of d3 path math.

### 3.3 Tooling

- `vitest` for engine tests
- `tsx` for running scripts
- `eas build --local` for APK (see §9)
- `scrcpy` over USB for projection

---

## 4. Data model

```ts
type Direction = 'DEBIT' | 'CREDIT';

interface RawSms {
  address: string;        // 'AD-HDFCBK'
  body: string;
  date: number;           // epoch ms
}

interface Transaction {
  id: string;
  direction: Direction;
  amount: number;         // rupees
  vpa?: string;           // 'swiggy@ybl'
  merchantHint?: string;  // free text from SMS
  accountTail?: string;   // '4471'
  balanceHint?: number;   // if SMS stated 'Avl Bal'
  refNo?: string;
  bank: BankCode;
  timestamp: Date;
  isFailure: boolean;     // 'could not be processed' / 'insufficient'
  raw: RawSms;
}

type Cadence = 'MONTHLY' | 'WEEKLY' | 'QUARTERLY';
type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface Mandate {
  id: string;
  normalizedVpa: string;
  displayName: string;
  amount: number;         // median
  cadence: Cadence;
  dayOfMonth: number;     // or dayOfWeek
  nextDebit: Date;
  confidence: number;     // 0–1
  occurrences: number;    // provenance: 'found from 6 SMS'
  sourceTxnIds: string[];
  priority: Priority;
  category: 'EMI' | 'SIP' | 'INSURANCE' | 'UTILITY' | 'OTT' | 'OTHER';
  isPaused: boolean;      // user intervention
}

interface IncomeEvent { amount: number; date: Date; confidence: number; }

interface BalancePoint { date: Date; balance: number; events: LedgerEvent[]; }
type BalanceCurve = BalancePoint[];

interface Shortfall {
  date: Date;
  deficit: number;        // positive number, how short
  atRisk: Mandate[];      // debits that would fail
}

type InterventionKind = 'SWEEP' | 'PAUSE' | 'SHIFT';
interface Intervention {
  kind: InterventionKind;
  label: string;          // 'Pause Netflix ₹649'
  target?: Mandate;
  amount?: number;
  penaltyAvoided: number; // ₹
  savedMandates: Mandate[];
  resultingCurve: BalanceCurve;  // precomputed for instant animation
}

type FailureCause = 'LIQUIDITY' | 'INTENTIONAL' | 'UNKNOWN';

interface Card {
  id: string;
  name: string;
  network: 'RUPAY' | 'VISA' | 'MASTERCARD' | 'AMEX';
  upiLinkable: boolean;
  rewardRate: number;           // % base
  categoryRates: Record<string, number>;  // mcc → %
  mccExclusions: string[];
  monthlyRewardCap?: number;
  feeWaiverThreshold?: number;  // annual spend
  annualFee?: number;
}

interface Recommendation {
  instrument: Card | 'UPI_BANK_ACCOUNT';
  rail: 'UPI' | 'CARD_SWIPE';
  reason: string;               // 'You are ₹4,000 from fee waiver'
  valueDelta: number;           // ₹ vs next-best
  mccConfidence: number;
  warnings: string[];           // 'This MCC is excluded on your Infinia'
}
```

---

## 5. Engine specification

All pure functions. No I/O, no dates from `new Date()` inside logic — **inject `now` as a parameter** so the simulator's world clock works.

### 5.1 `parse/`

```ts
parseSms(raw: RawSms): Transaction | null
```

Registry of bank-specific regex, keyed by sender entity code.

**Sender IDs:** Indian bank SMS arrive as `AD-HDFCBK`, `VM-SBIINB`, `JD-ICICIB`, `AX-KOTAKB`, `VK-AXISBK`, `BP-PNBSMS`. **Match on the trailing 6-character entity code, not the full header** — the two-letter operator prefix and the `-S`/`-T`/`-P` DLT suffix both vary and will silently break your filter.

Extract: direction, amount, VPA, merchant hint, account tail, balance hint, ref no, failure flag.

Return `null` for non-financial messages. Never throw.

### 5.2 `detect/`

```ts
detectMandates(txns: Transaction[], now: Date): Mandate[]
```

**Do not use autocorrelation.** With 3–6 observations per mandate the ACF is fragile and will eat hours. Use this instead:

1. Normalise VPA — lowercase, strip merchant suffixes and numeric order IDs
2. Bucket by `(normalizedVpa, amount ±2%)`
3. Sort timestamps, compute inter-arrival gaps
4. Take the **median** gap; classify:
   - 28–31 days → `MONTHLY`
   - 6–8 days → `WEEKLY`
   - 89–92 days → `QUARTERLY`
5. `confidence = f(occurrenceCount, gapVariance)` — require ≥3 occurrences to surface
6. Assign `category` and `priority` from a keyword table on `displayName`

Twenty lines of real logic, robust, and explains in one sentence on stage.

### 5.3 `project/`

```ts
buildLedger(txns: Transaction[]): ShadowLedger
inferIncomeEvents(txns: Transaction[]): IncomeEvent[]
projectBalance(ledger: ShadowLedger, mandates: Mandate[],
                income: IncomeEvent[], now: Date, days = 45): BalanceCurve
```

- Ledger walks transactions forward; whenever `balanceHint` is present, **snap to it** and record the drift (drift is a nice diagnostic to show).
- Income inference: recurring large credits. Handle both salaried (fixed day) and irregular (freelance) patterns — the synthetic data has both.
- Projection excludes `isPaused` mandates.

### 5.4 `guard/`

```ts
findShortfalls(curve: BalanceCurve, buffer = 500): Shortfall[]
rankByPriority(mandates: Mandate[]): Mandate[]
proposeInterventions(shortfall: Shortfall, mandates: Mandate[],
                      ledger: ShadowLedger): Intervention[]
```

Priority order: `EMI > SIP > INSURANCE > UTILITY > OTT > OTHER`.

Generate 2–3 interventions max, ranked by `penaltyAvoided`. **Precompute `resultingCurve` for each** so the tap-to-animate is instant with no jank.

### 5.5 `attribute/`

```ts
classifyFailure(failed: Transaction, ledger: ShadowLedger): FailureCause
```

Balance at that timestamp `< amount` → `LIQUIDITY` (needs a calendar shift). Balance healthy → `INTENTIONAL` (user actively stopped it; needs a value/reminder prompt). Cheap to build — we already have the ledger.

### 5.6 `route/`

```ts
resolveMcc(vpa: string, qrPayload?: UpiIntent): { mcc: string; confidence: number }
recommendInstrument(mcc: string, amount: number, cards: Card[],
                     mtdSpend: Record<string, number>): Recommendation
```

Logic order: filter by `mccExclusions` → check `monthlyRewardCap` headroom → check `feeWaiverThreshold` proximity → compute effective ₹ value → rank. If the winner is not `upiLinkable`, set `rail: 'CARD_SWIPE'` and say so explicitly in `reason`.

### 5.7 Static data

Hand-authored, ~200 lines total.

- `cards.json` — 8–10 cards with real-ish reward structures, exclusions, caps, waiver thresholds
- `mcc_map.json` — MCC → label
- `vpa_patterns.json` — `swiggy|zomato` → 5814, `bses|torrent|adani` → 4900, `netflix|hotstar` → 4899, etc.

---

## 6. Working with the real device inbox

We have an Android device with real SMS history. This is our biggest credibility asset **and** our biggest unscripted risk.

### 6.1 The split

- **Real inbox → the discovery moment.** Mandate Hub populates from actual messages, live. *"This is my real phone. I never told it about any of these."* That sentence wins more than a polished chart does.
- **Seeded inbox → the bounce moment.** Our real balance isn't heading to zero on day 12. Bounce Guard runs on the synthetic scenario. **Say so out loud** — "switching to a simulated month so you can see the failure case." Judges respect it and it costs nothing.

Two Settings toggles: `Inbox: [Real | Seeded]` and `Redact: [on | off]`.

### 6.2 Abstract the source — do this first

```ts
interface InboxSource { read(since: Date): Promise<RawSms[]> }
class DeviceInbox implements InboxSource   // real READ_SMS
class SeededInbox implements InboxSource   // bundled JSON
```

If SMS permission fights us at 3am, flip to seeded and the demo is unaffected. **Never let a runtime permission stand between us and the stage.**

### 6.3 Hour 1: dump once, replay forever

```ts
// scripts/dump-inbox.ts — run once from the dev client, share the file out
const msgs = await SmsAndroid.list({ box: 'inbox', maxCount: 5000 });
// keep only: address, body, date
writeFile('fixtures/real_inbox.json', JSON.stringify(msgs));
```

Then develop against that file under `vitest` on a laptop for the next 20 hours. Rebuilding an APK to test a regex is how teams lose a night.

**Immediately run `scripts/measure.ts` and record three numbers:**

| Metric | Decision it drives |
|---|---|
| % of financial SMS parsed | If < 70%, we are writing regex, not features |
| Distinct bank sender IDs present | Prioritise only those formats; ignore banks we don't have |
| Mandate candidates found | If < 3, the discovery moment falls flat |

**If fewer than 3 real mandates:** blend. Load the real inbox, inject 4–5 synthetic mandate threads dated into the actual timeline. Still visually a real inbox, still honest if we say "plus a few injected for coverage."

**If parse rate is ~40%:** cut to the top two banks by volume and hardcode those formats. Coverage breadth is worthless when only one phone is being demoed.

### 6.4 Device gotchas

- Trigger the runtime `READ_SMS` prompt **behind a button, not on mount**. An unhandled denial on app open is a black screen on stage.
- MIUI / ColorOS / Funtouch have a *second* SMS-and-autostart permission in their own settings that the standard prompt doesn't cover. Grant it manually the night before and never revoke.
- Disable battery optimisation for the app or a background parse can be killed mid-demo.
- Some OEM skins shunt bank SMS into a separate "Transactions" bucket. If counts look low, query `box: 'all'` instead of `box: 'inbox'`.

### 6.5 Privacy — non-negotiable

A real inbox will be on a projector in front of strangers and probably recorded.

Build the **redaction layer in the render path, not the data path** (~30 min, do it around hour 16):

- VPAs → `sw****@ybl`
- Amounts → real (they're the point)
- Salary credit → render as "Income event," not the figure
- Account tails → `••4471`
- **Any SMS not classified as financial is never rendered at all**

Ship with redact **on** by default.

**Tonight:** manually scroll the demo phone's inbox and confirm there is nothing — OTPs, personal messages, medical, anything — that would be catastrophic flashing on screen during a scroll animation. Filter to financial senders before rendering, always.

Pitch line: *nothing leaves the device; the app makes no network calls.* Already true of our architecture — make sure someone says it.

---

## 7. UI specification

Three screens matter. Everything else is a stub.

### 7.1 Calendar (the hero screen)

- 45-day forward balance curve, SVG path from `d3-shape` `curveMonotoneX`
- **Red fill below the zero line**, emerald above
- Mandate pills anchored on their debit dates
- Draggable scrubber showing `B_t` at any date
- Tap the dip → intervention sheet

### 7.2 Intervention sheet

- 2–3 ranked options
- Each shows `₹250 penalty avoided` prominently
- One tap → sheet dismisses, curve re-animates to `resultingCurve`, haptic fires, dip turns green
- **This is the demo.** Budget real time here.

### 7.3 Mandate Hub

- Auto-discovered list, grouped by priority
- Confidence badge per mandate
- Provenance line: *"found from 6 SMS"* — tap to expand the source messages (redacted)

### 7.4 Design tokens

- Dark background, single accent: **amber = warning, emerald = resolved**
- Numbers in `Inter` with tabular figures so digits don't jitter during animation
- No more than two font sizes on any screen

---

## 8. UPI simulator (demo harness)

Built as a **hidden tab inside the same APK**, not a separate web app. One artifact, no network, no window-switching on stage.

**`SimulatorScreen` contains:**

1. **World clock** — a date slider that advances "today." Everything downstream recomputes. This is how we show a bounce approaching in 30 seconds of stage time. *(Requires that every engine function takes `now` as a parameter — see §5.)*
2. **Fake PSP checkout** — a GPay-lookalike. Merchant chips (Swiggy / BigBasket / Croma / Landlord), amount field, Pay button. On tap, the router surfaces a banner: *"Pay with Amex — ₹4,000 to fee waiver."* This is where feature 5 gets its moment without needing real intent interception.
3. **SMS injector** — buttons that push a synthetic SMS into the seeded inbox: `[Salary credited]` `[SIP debited]` `[Autopay FAILED — insufficient funds]`. Live on stage, the mandate list updates and the curve redraws.
4. **Scenario presets** — `Healthy`, `Tight month`, `Bounce imminent`. Judges will ask "what if…"; we tap a preset.

**Synthetic generator** (`scripts/generate.ts`): ~400 SMS across 6 bank formats, 8 seeded mandates, one irregular freelance income pattern, one guaranteed shortfall on day 12. **Deterministic seed** so the demo is byte-identical every run.

**Projection:** `scrcpy` over USB — free, near-zero latency, doesn't care about venue HDMI. Test it before we need it.

---

## 9. Build & release

```bash
npx expo prebuild --clean
eas build -p android --profile preview --local
```

- **`--local` is not optional.** EAS cloud queues run 20–40 min during hackathon crunch. Local Gradle takes ~4 min once warm.
- `eas.json` → `preview` profile must set `"buildType": "apk"`. The default is `app-bundle`, which produces an `.aab` you **cannot sideload**.
- **Build a debug APK at hour 6**, even with placeholder screens. Discovering that `READ_SMS` doesn't merge into the manifest at hour 22 is a project-ending bug.
- Throwaway keystore, committed (hackathon only).
- `targetSdk 34`, `minSdk 26`.
- Final APK on a USB stick **and** a QR-coded Drive link. Venue wifi will fail.

---

## 10. Roles

### Person A — Design & UI Lead

**Scope:** `apps/mobile/views/` — visual layer and screen components.
**Output:** Every screen, layout, style and animation, built against static/mock data.

- **Cash-Flow Calendar** — 30-day interactive SVG balance curve, `d3-shape` + `react-native-svg`, shortfall dips filled red
- **Intervention Bottom Sheet** — `@gorhom/bottom-sheet`, penalty-avoidance stats, 1-tap resolution options
- **Mandate Hub** — discovered auto-debit list, confidence badges, "found from X SMS" provenance
- **Simulator UI** — control dashboard: World Clock slider, SMS injector buttons, fake GPay checkout
- **Redaction layer** *(§6.5)* — render-path masking of VPAs and account tails; consumes B's `isFinancial` flag

**Golden rule:** Components stay purely visual. Accept props, render, fire callbacks. No business or mathematical logic inside a component.

### Person B — Feature Logic & Engine Lead

**Scope:** `packages/engine/` — core analytics and rules.
**Output:** Pure TypeScript, zero platform dependencies, tested millisecond-fast under `vitest`.

- **`parseSms`** — bank-specific regex registry (HDFC, SBI, ICICI, Axis, Kotak, PNB); match on trailing entity code, not full header
- **`detectMandates`** — bucket recurring VPAs by normalised handle + amount, infer cadence from **median inter-arrival gap** *(see §5.2 — this is the implementation, whatever we call it on stage)*
- **`projectBalance`** — daily running balance `B_t` against upcoming mandates and inferred income events
- **`findShortfalls`** + **`proposeInterventions`** — detect dips, rank by priority, precompute resulting curves
- **`recommendInstrument`** — VPA/MCC → card, subject to exclusions, caps and waiver thresholds
- **`classifyFailure`** — Cause Attribution: liquidity shortfall vs intentional cancellation
- **`generate.ts`** — synthetic SMS corpus (400+ messages, deterministic seed) — B owns this because B needs the fixtures at hour 0

**Golden rule:** No React, no native bridges, no `new Date()` inside logic. Everything testable in `vitest`.

### Person C — Integration, Build & Stage Lead

**Scope:** Repo setup, Zustand store, native bridges, demo device, stage.
**Output:** A merged, runnable APK that works on stage with no network and no build surprises.

- **Contract setup (Hour 1)** — commit `types.ts` **and `mocks.ts` together** so A is unblocked immediately (see §10.1)
- **Wiring & state** — bind B's pure functions into Zustand; expose selectors to A's components
- **`DeviceInbox`** — SMS config plugin, runtime permission, real-inbox dump, `measure.ts` report *(hour-2 hard gate)*
- **`SeededInbox`** + simulator wiring — World Clock drives `now` through every selector
- **Build & stage** — `eas build --local` pipeline, early sideload test, `scrcpy` over USB, pitch deck

**Golden rule:** Own integration from hour 1. UI and engine stay loosely coupled through the store — they must never import each other.

### 10.1 Contract rules

The split only works if the interface holds. Three rules:

1. **`types.ts` ships with `mocks.ts`.** Hardcoded fixtures conforming to every interface, including one populated shortfall scenario. A builds the entire UI against mocks; integration becomes a one-line selector swap. Without this, A idles until hour 7.
2. **After hour 3, `types.ts` is additive-only.** New optional fields are fine. Renaming or removing a field requires all three people to stop and agree — a silent breaking change at hour 14 costs more than the feature it enables.
3. **`now: Date` is a required parameter on every engine function that touches time.** C enforces this at the contract level. If anyone calls `new Date()` inside the engine, the simulator's World Clock silently does nothing and it will be debugged at hour 18.

### 10.2 Timeline

| Hour | A — UI | B — Engine | C — Integration |
|---|---|---|---|
| 0–1 | Design tokens, screen skeletons | Repo, workspace, vitest, `sms_cases.json` fixtures **first** | **`types.ts` + `mocks.ts` committed** |
| 1–2 | Mandate Hub layout vs mocks | `generate.ts` synthetic corpus | Expo dev client + SMS plugin — **prove a real read works** |
| 2–3 | Confidence badges, provenance expand | `parseSms` registry | Dump real inbox → `measure.ts` → **report the 3 numbers** |
| 3–7 | Balance curve SVG + reanimated | `detectMandates` | Zustand store, `InboxSource` swap, mmkv |
| 7–12 | Intervention sheet, re-animation | Shadow ledger, income inference, `projectBalance` | **Debug APK builds & installs (hour-6 gate)**, wire Hub to engine |
| 12–16 | Simulator dashboard UI, checkout screen | `findShortfalls`, `proposeInterventions` | World Clock → `now` plumbing, scenario presets |
| 16–19 | **Redaction layer**, empty states, polish | `recommendInstrument`, `classifyFailure` | SMS injector wiring, `scrcpy` setup |
| 19–21 | Bug support | Bug support | Slides, screenshots, README |
| 21–23 | **Feature freeze.** Final APK. Load onto demo device. | | |
| 23–24 | **Rehearse twice, end to end, on the projector.** | | |

**Hard gates:**
- **Hour 1** — `types.ts` + `mocks.ts` committed, or A is blocked and the schedule is already broken.
- **Hour 2** — SMS read proven on the real device, or we go seeded-only and tell the judges.
- **Hour 6** — debug APK installs and launches.
- **Hour 21** — feature freeze. No exceptions. Unfinished work becomes a roadmap bullet.

---

## 11. Demo script (90 seconds)

1. *"This is my actual phone."* Open Mandate Hub. Eight recurring debits, discovered from SMS, no bank login. **(5s pause. Let it land.)**
2. Tap one → provenance: found from 6 messages.
3. *"Switching to a simulated month so you can see the failure case."* → Calendar. Curve dips red on the 12th.
4. *"₹5,000 SIP fails here. NACH bounce charge: ₹250, plus a missed investment."*
5. Tap the dip. Sheet: **Pause Netflix ₹649 → SIP survives.**
6. One tap. Curve flattens green. Haptic. `₹250 avoided`.
7. Simulator tab → fake checkout, ₹8,000 at Croma → *"Don't use UPI. Swipe the Amex — you're ₹4,000 from your fee waiver."*
8. Constraints slide. Own them out loud.

---

## 12. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| SMS config plugin fails | Medium | `InboxSource` abstraction; seeded fallback proven by hour 2 |
| Parse rate < 70% on real inbox | Medium | Cut to top 2 banks; blend synthetic mandates |
| < 3 real mandates found | Medium | Inject synthetic threads into real timeline, disclosed |
| Curve animation janky | Low | Precompute `resultingCurve`; reanimated on UI thread |
| APK build fails late | Low | Hard gate at hour 6 |
| Something private on screen | **High impact** | Redaction on by default; manual inbox audit tonight |
| Venue projector/wifi fails | Medium | scrcpy over USB; APK on USB stick |

---

## 13. Roadmap slide (what we'd build next)

- Micro-Spend Aggregator — post-hoc "pain of paying" for sub-₹500 transactions
- RBI Account Aggregator integration to replace SMS parsing
- Real UPI Autopay mandate pause via PSP partnership
- On-device notification listener as an SMS alternative
- Multi-account households
