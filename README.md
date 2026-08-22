# TiXPay — On-Device Cash-Flow Guard

> **React Native + Expo · Pure TypeScript engine · 349 tests in under 2 seconds · Zero network calls in the core engine**

TiXPay reads one bank statement you hand it, discovers your recurring auto-debits, projects
your balance 30 days forward, and stops you at the moment of payment when that payment is
going to bounce something important — naming the exact debit, the exact date, and the exact
shortfall.

> **This leaves you ₹3,600 short on 7 April.**
> Your ₹1,899 LIC Premium will bounce.

---

## 🔒 What it touches, and what it does not

This is the part worth reading first, because it is the design decision the rest of the
product follows from.

| | |
|---|---|
| **Input** | One statement file you pick, once, through the system file picker |
| **Permissions** | `CAMERA` only, for QR scanning, requested at the moment of use |
| **Network** | The engine and every screen except Money Coach: none. Money Coach (optional, see below) is the one deliberate exception — it calls the Gemini API, and sends it only already-computed aggregates, never a raw transaction |
| **Storage** | None. Transactions live in memory and die with the process |
| **SMS** | Not read. `READ_SMS` and `RECEIVE_SMS` are removed at manifest-merge time — verify it yourself with `aapt2 dump badging apk/tixpay-latest.apk`, which lists exactly `CAMERA`, `INTERNET` and `VIBRATE` |

An earlier build read the SMS inbox. We removed it. `READ_SMS` means the ability to read
banking OTPs, it is a restricted permission on Google Play that expense tracking does not
qualify for, and a file the user chooses is a scoped one-time grant instead of a standing
one over their whole message history.

It is also **better data**. A statement is complete — every debit, not only the ones that
happened to fire a notification — and it states a running balance on every row. That is why
the shadow ledger reconciles to **zero drift** here rather than to a bounded estimate.

The privacy claim is asserted by the test suite, not just by this file: see
`demoCorpus.test.ts › what a statement does NOT contain`.

---

## 🚀 What it does

### The core: cash-flow guard

1. **Pre-payment intercept (`evaluatePayment`)** — the headline.
   Scan a UPI QR or type an amount. The verdict is recomputed **on every keystroke**
   against a hypothetical 30-day curve: does this payment create a new shortfall, deepen an
   existing one, or pull one earlier? Also recommends a better rail
   (*"swipe your Amex SmartEarn"*) when the payment is fine but the instrument isn't.

2. **Mandate discovery** — recurring auto-debits found by **median inter-arrival gap**
   (28–31d → MONTHLY, 6–8d → WEEKLY, 89–92d → QUARTERLY), grouped by normalised
   counterparty and amount (±5%), scored `0.6·countScore + 0.4·varianceScore`, then ranked
   EMI → SIP → Insurance → Utility → OTT.

3. **Shadow ledger and 30/60/90-day projection** — the statement replayed forward over
   detected mandates and inferred income (salaried and irregular streams are modelled
   separately). The horizon is real state, not a view filter: the guard, the curve and every
   intervention are recomputed against it.

4. **Bounce guard and one-tap remedies** — shortfalls are days the curve dips below a ₹500
   buffer. The guard proposes the smallest set of **pauses, sweeps, or date shifts** that
   lifts it back, and **verifies each one actually clears the dip before offering it**.

5. **Keeper** — the reserve a sweep is funded from. Accepting *"Move ₹4,500 to this
   account"* debits the jar and credits the account, so a rescued curve is funded rather
   than asserted.

### WealthTech: the analysis layer

6. **Spend Insights** — category-wise spend over a trailing 30/60/90-day window, with the %
   change vs the window before it, plus per-merchant and per-day breakdowns — off the same
   categorised transactions the mandate detector reads.

7. **Goals** — Keeper generalised into a named, dated savings goal. "On track" is computed
   from the account's actual trailing surplus (`computeAvgMonthlySurplus`), never an assumed
   savings rate.

8. **SIP Readiness Check** — before committing to a new SIP, run it against the same 90-day
   shortfall projection the guard already trusts. Answers "can I afford this?" with a dated,
   rupee-figure verdict instead of a rule of thumb.

9. **Subscription audit (`auditSubscriptions`)** — everything charging the account on
   repeat, priced per year. Deliberately *not* `detectMandates`: that one is strict because
   a false mandate poisons the projected curve, while this one asks the cheaper question
   ("what are you paying for on repeat?") with looser tolerances and never touches the
   projection. On a student's UPI account with no auto-debits at all — the case the strict
   detector returns nothing for — this is the feature that still has something true to say.

10. **Money Map (`computeMoneyMap`)** — the theme brief asks for investments spread across
    platforms pulled into one view. We cannot see holdings, and inventing a portfolio value
    would be the most dishonest thing this app could do. So it consolidates **commitments
    and run-rates** instead of balances, and says so on the screen: *"You are investing
    ₹7,000 a month across 2 platforms"* is defensible; *"your portfolio is worth ₹4.2 lakh"*
    is not. Opens on a one-line health verdict.

11. **Risk Profile (`computeRiskProfile`)** — done the way the regulated version is done:
    **attitude and capacity scored separately, and the lower of the two wins.** A five-
    question quiz measures how someone feels about risk on a calm afternoon; the statement
    can measure whether their account would survive the drawdown, so `capacityScore` is
    computed from the emergency buffer, savings rate, and committed share of income. When
    capacity is the binding constraint, the screen says which number capped it and why.
    Maps to a broad asset mix and stops there — it is not advice about a security.

12. **Money Coach** — a chat interface over items 6–11, grounded via Gemini
    function-calling. Reachable from the chat bar at the top of the Home screen, which sends
    your question straight into the conversation. See "What the Money Coach is (and isn't)".

### The app around it

13. **Onboarding** — mobile + OTP, PAN-shaped identity check, bank account discovery, UPI
    PIN setup (entered twice, and the PIN is what every later PIN prompt is checked
    against), card linking, then statement import and the analysis pass. Nothing is
    pre-filled; you onboard with your own details.

14. **Home** — scan-and-pay hero, quick actions, recent payees drawn from the statement's
    real counterparties, and an **Account Insights card that starts hidden**. Revealing the
    balance, safe-to-spend and Keeper reserve requires the UPI PIN, with no biometric
    bypass on that particular gate.

15. **Everyday Utilities** — multi-step biller flows for electricity, mobile recharge and
    FASTag, each running through the same pre-payment cash-flow guard as any other payment.

16. **Simulator dashboard** (☰) — World Clock scenario presets, horizon control, and
    redaction toggle, for driving the demo.

---

## 🧠 How the intelligence works — and what it is not

The TiXPay **engine** contains no machine-learning model, no neural network, and no LLM.
No weights, no inference runtime. This is deliberate, and it is worth saying out loud
before anyone asks. (Money Coach, the one LLM surface, is scoped narrowly and described
below.)

What the engine actually is: a **deterministic statistical inference layer** over a bank
statement. Every "insight" the app shows is arithmetic you can read, step through, and
unit-test.

| Feature | What people assume | What it actually is |
|---|---|---|
| Recurring-debit discovery | Sequence model / clustering | Group by counterparty + amount (±5%), take the **median inter-arrival gap**, bucket it. Confidence = `0.6·countScore + 0.4·varianceScore`. |
| Statement understanding | NLP / entity extraction | Tolerant column binding across bank export layouts, plus narration parsing for the counterparty. A hand-built case corpus is the regression suite. |
| Merchant category (MCC) | Classifier | VPA and narration heuristics over a seed lookup table, every result carrying an explicit confidence score. |
| Balance projection | Time-series forecasting | A ledger replayed forward over detected mandates and inferred income. Pure accounting. |
| Interventions | Recommender system | Constraint search: the smallest set of pauses, sweeps or shifts that lifts the curve above the ₹500 buffer — each **verified** against a re-projection before being offered. |
| Risk profiling | Personality model | Two independent scores — a questionnaire for attitude, statement-derived ratios for capacity — with the lower one binding. |

### Why this is the right call here, not a shortcut

- **Auditable.** When the app says *"your ₹1,899 LIC premium bounces on the 9th,"* we can
  show the exact six statement rows and the median gap that produced it. In personal
  finance, an unexplainable number is a number nobody acts on.
- **Deterministic.** Same file, same `now`, same output — every time. That is why the whole
  engine is covered by **349 tests that run in under two seconds** instead of by eyeballing
  an APK.
- **Genuinely on-device.** Zero network calls, zero bytes leave the phone, runs on a ₹8,000
  Android device with no accelerator.
- **Cold-start honest.** It works on the third occurrence of a mandate, not after enough
  data to train on.

If a judge asks **"where's the AI?"** about the engine — Spend Insights, Goals, SIP Check,
subscriptions, Money Map, Risk Profile, mandate discovery, projection, guard — answer
plainly: *"There isn't one, and that's a design decision. Here's the arithmetic instead."*
Do not hedge, and do not call a regex "NLP." The one place an LLM appears is Money Coach.

### What the Money Coach is (and isn't)

Money Coach is a chat screen over Gemini (`gemini-3.1-flash-lite`, set in
`apps/mobile/src/config.ts`), added because it's useful and because the WealthTech track
requires a conversational interface. It is **not** a general-purpose chatbot layered over
raw data:

- It never receives a transaction, account number, or balance history. `coachTools.ts`
  exposes five tool calls — `get_spend_breakdown`, `get_goal_status`,
  `check_sip_affordability`, `get_mandates`, `get_safe_to_spend` — each returning only an
  aggregate the engine already computed.
- The system prompt forbids stating any rupee figure, percentage, or date that didn't come
  back from a tool call in that conversation, so it narrates the engine's numbers rather
  than inventing its own.
- Everything else in the app — the pre-payment intercept, mandate discovery, the balance
  curve, the guard — is unchanged: deterministic, offline, and covered by the same 349
  tests.

Requires `EXPO_PUBLIC_GEMINI_API_KEY` in `apps/mobile/.env` (see `.env.example`). Without
a key, every other screen works exactly as before — Money Coach just shows a banner
explaining what's missing instead of crashing.

### On the roadmap, honestly scoped

- A small on-device classifier for **merchant → category**, shipped as JSON weights with no
  native dependency and no network. It is the one place ML would beat what we have, because
  MCC resolution is our weakest link. Not in this build.
- **Account Aggregator** (RBI's consent framework — Setu, Finvu, Perfios) as the production
  ingestion rail. Statement import is the zero-integration wedge; AA is the regulated path,
  and it needs FIU status we do not have.

### What is simulated

Payments. TiXPay is not a PSP and holds no UPI licence, so confirming a payment applies a
debit to the local ledger and says **"SIMULATED — no money moved"** on the receipt. The UPI
PIN is likewise a local 4-digit gate, labelled as simulated on the screen where it is set.
QR scanning and `parseUpiDeepLink` are real — a genuine shop QR scans and resolves. The
analysis is the product; the rail is not.

---

## ⚡ Running it

Node 18+ and `pnpm`. From the workspace root:

```bash
pnpm install
```

### Engine tests — the fastest way to see it work

```bash
pnpm test
```

349 tests across 17 files, under two seconds. Includes `appStore.test.ts`, which drives the
real app store through the whole demo headlessly — import, intercept, pay, rescue.

### Money Coach's API key (optional)

Only needed for the Money Coach chat screen — everything else runs with no setup.

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Then put your key in `apps/mobile/.env` as `EXPO_PUBLIC_GEMINI_API_KEY=...` and restart the
dev server — Expo inlines `EXPO_PUBLIC_*` vars at build time.

### The app, in a browser

```bash
node scripts/dev-web.mjs --port 8090
```

No device or emulator needed. Opens on the splash, then onboarding; **"⚡ Skip to demo"**
jumps straight in with the bundled sample statement.

### The app, on an Android device

The release APK builds with a single script from the repo root. It uses the pinned JDK and
Android SDK under `.tools/`, so it needs nothing installed globally:

```cmd
build-apk.bat
```

The signed APK is copied to `apk/tixpay-latest.apk` when it finishes.

For a dev build against a running Metro server instead:

```bash
pnpm --filter tixpay-mobile android
```

### Typecheck everything

```bash
pnpm typecheck
```

---

## 📱 Android specifics

- **Launcher icon** — generated from `logo.jpeg` into every density, plus an
  `mipmap-anydpi-v26` adaptive icon with a monochrome layer for themed icons.
- **Status bar hidden** app-wide, via `WindowInsetsControllerCompat` in `MainActivity.kt`
  rather than `android:windowFullscreen` — the legacy flag hides the bar but breaks
  `adjustResize`, which would put the soft keyboard on top of the chat bar and every
  onboarding field.
- **Hardware back** is handled by a nav stack in `App.tsx` (`src/lib/useBackHandler.ts`):
  it dismisses the topmost layer first, then pops one screen, and only exits the app from
  Home. Every `Modal` also carries an `onRequestClose`, because RN modals swallow the back
  press before any `BackHandler` sees it.
- **Permissions** are stripped with `tools:node="remove"` entries in the committed
  `AndroidManifest.xml`. `plugins/withMinimalPermissions.js` declares the same list, but it
  only runs during `expo prebuild` — and since `android/` is committed and built directly,
  prebuild never runs, so the plugin alone was not enough. The merger rule is what actually
  holds, because it removes a permission no matter which transitive dependency asked for it.
  The shipped APK declares `CAMERA`, `INTERNET`, `VIBRATE`, `ACCESS_NETWORK_STATE` and
  Expo's own receiver permission — nothing else.

---

## 🎬 Demo script

Every number below is produced by the engine from `fixtures/demo_statement.csv`. Nothing on
these screens is hardcoded — the engine test suite asserts these exact figures, so what you
see on stage is what CI checks.

**Moment 0 — the import (30 seconds, and it is the privacy pitch)**

Onboard with your own number and name, or tap **⚡ Skip to demo**. The import screen is the
first thing with data on it, because there is genuinely nothing to show before a file is
chosen. Tap **Try it with a sample statement**. The analysis screen reports what was
actually read: *267 of 267 rows · HDFC ••4471 · 8 auto-debits found*.

> Say out loud: *"No SMS permission, no bank login, no network. One file, and it never
> leaves the phone."*

**Moment 1 — the intercept (the headline)**

1. Insights opens clear: balance **₹21,597**, no shortfalls in the next 30 days.
   *"Right now this person is fine."*
2. **Pay** → type **₹500**. Amber: *"Better paid by card — swipe your Amex SmartEarn."* No
   panic, just a better rail.
3. Type **₹2,500**. Still amber. The guard is quiet because there is nothing to warn about.
4. Type **₹8,000**. Red:
   > **This leaves you ₹3,600 short on 7 April.**
   > Your ₹1,899 LIC Premium will bounce.

   Three at-risk debits listed underneath: LIC Premium, BESCOM Electricity, Netflix.

   The point to make out loud: *the verdict is recomputed on every keystroke.* Hand a judge
   the phone and ask them to type their own number.

**Moment 2 — the resolution**

5. Tap **Pay anyway**. The receipt says **SIMULATED — no money moved**, and shows what the
   payment did: balance **₹13,597**, next shortfall **7 Apr · ₹3,600 short**.
6. Back on Insights the curve now dips below zero, *Safe to Spend* has fallen to **₹0**, and
   *Bounce Risk* reads **₹350** — the real penalty exposure from the engine's table, not a
   guess.
7. Tap the dip. The engine offers what it computed: a **₹4,500 sweep from your Keeper**
   (₹12,450 available) or **pausing the ₹12,450 Bajaj EMI** — each naming exactly which
   mandates it saves.
8. Confirm one. The curve re-projects for real, *Safe to Spend* jumps back up, and the jar
   visibly drops if you swept. Green means the projection genuinely cleared, not that a
   button was pressed.

**Moment 3 — the WealthTech tools**

From Insights → **Tools**: Spend Insights, Recurring, Money Map, Risk Profile, SIP Check,
Money Coach. The two worth demoing:

- **Risk Profile** — answer the five questions aggressively. The profile still comes back
  capped, and the screen names the capacity figure that capped it.
- **Money Coach** — type into the chat bar on Home. Ask *"what can I safely spend today?"*
  and it answers with the same rupee figure Insights shows, because it got it from a tool
  call rather than from the model.

**Scenario presets** (☰ → Simulator) are dates, not doctored files:

| Preset | Date | What it shows |
|---|---|---|
| `healthy` | 13 Mar | Flat and clear. Nothing warns. |
| `tight` | 26 Mar | **Default.** Clear on open; ₹8,000 creates a fresh shortfall. |
| `bounce` | 1 Mar | Already short on the 11th — Insights opens on a red dip. |

Moving the World Clock is the only thing that changes between them. No transaction is
fabricated to make a demo land, which is the answer to *"is this rigged?"*

---

## 📁 Repository structure

```
tixpay/
├── packages/
│   ├── engine/                 # @tixpay/engine — the pure TS analytical core
│   │   ├── src/
│   │   │   ├── parse/          # CSV tokeniser, statement parser, UPI QR deep links
│   │   │   ├── detect/         # Median-gap recurring mandate discovery
│   │   │   ├── project/        # Ledger, income inference, balance curve
│   │   │   ├── guard/          # Shortfall finder & verified intervention search
│   │   │   ├── analyze/        # Spend, goals, SIP check, subscriptions,
│   │   │   │                   #   Money Map, health verdict, risk profile
│   │   │   ├── attribute/      # Failed-transaction cause classifier
│   │   │   ├── route/          # MCC resolver & card router
│   │   │   ├── evaluate/       # The pre-payment intercept
│   │   │   ├── pipeline.ts     # runPipeline / runPipelineFromStatement
│   │   │   └── types.ts        # The shared contract
│   │   ├── fixtures/           # demo_statement.csv — the synthetic demo corpus
│   │   └── test/               # 349 tests, including the app-store wiring suite
│   └── types/                  # Re-exports the engine contract (never a copy of it)
├── apps/
│   └── mobile/                 # React Native + Expo client
│       ├── App.tsx             # Screen switch, nav stack, hardware-back handling
│       ├── src/screens/        # Home, Insights, Pay, ShortfallSheet, MandateHub,
│       │   │                   #   Goals, SpendInsights, SipCheck, Subscriptions,
│       │   │                   #   MoneyMap, RiskProfile, Chat, Bank, Simulator
│       │   └── onboarding/     # Splash → OTP → KYC → banks → PIN → cards → import
│       ├── src/components/     # UpiPinModal, UtilityFlowModal, BalanceCurve, tabs
│       ├── src/lib/            # Gemini client, coach tool definitions, back handler
│       ├── src/data/           # The bundled sample statement (generated)
│       ├── store/              # Zustand store — the only place UI meets engine
│       └── android/            # Prebuilt native project (icons, manifest, theme)
├── build-apk.bat               # One-shot release APK build → apk/tixpay-latest.apk
└── scripts/dev-web.mjs         # Browser preview launcher
```

Engine internals, algorithms and the maths: [`packages/engine/README.md`](packages/engine/README.md).

> **Note on the `PERSON_*_BRIEF.md` and `TIXPAY_BUILD_SPEC.md` files:** these are the
> original planning documents from the build, written when ingestion was SMS-based. They
> are kept as a record of how the project was scoped and split, and they do **not** describe
> the current build. This README and the engine README are the current documentation.
