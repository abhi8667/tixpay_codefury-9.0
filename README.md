# TiXPay — On-Device Cash-Flow Guard

> **React Native + Expo · Pure TypeScript engine · 281 tests · Zero network calls**

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
| **Network** | None. There is no `fetch`, no `axios`, and no URL anywhere in the app or engine |
| **Storage** | None. Transactions live in memory and die with the process |
| **SMS** | Not read. `READ_SMS` and `RECEIVE_SMS` are explicitly blocked in the manifest |

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

1. **Pre-payment intercept (`evaluatePayment`)** — the headline.
   Scan a UPI QR or type an amount. The verdict is recomputed **on every keystroke**
   against a hypothetical 30-day curve: does this payment create a new shortfall, deepen an
   existing one, or pull one earlier? Also recommends a better rail
   (*"swipe your Amex SmartEarn"*) when the payment is fine but the instrument isn't.

2. **Mandate discovery** — recurring auto-debits found by **median inter-arrival gap**
   (28–31d → MONTHLY, 6–8d → WEEKLY, 89–92d → QUARTERLY), grouped by normalised
   counterparty and amount (±5%), scored `0.6·countScore + 0.4·varianceScore`, then ranked
   EMI → SIP → Insurance → Utility → OTT.

3. **Shadow ledger and 30-day projection** — the statement replayed forward over detected
   mandates and inferred income (salaried and irregular streams are modelled separately).

4. **Bounce guard and one-tap remedies** — shortfalls are days the curve dips below a ₹500
   buffer. The guard proposes the smallest set of **pauses, sweeps, or date shifts** that
   lifts it back, and **verifies each one actually clears the dip before offering it**.

5. **Keeper** — the reserve a sweep is funded from. Accepting *"Move ₹4,500 to this
   account"* debits the jar and credits the account, so a rescued curve is funded rather
   than asserted.

---

## 🧠 How the intelligence works — and what it is not

TiXPay contains **no machine-learning model, no neural network, and no LLM.** No weights,
no inference runtime, no API keys. This is deliberate, and it is worth saying out loud
before anyone asks.

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

### Why this is the right call here, not a shortcut

- **Auditable.** When the app says *"your ₹1,899 LIC premium bounces on the 9th,"* we can
  show the exact six statement rows and the median gap that produced it. In personal
  finance, an unexplainable number is a number nobody acts on.
- **Deterministic.** Same file, same `now`, same output — every time. That is why the whole
  engine is covered by **281 tests that run in under a second** instead of by eyeballing an
  APK.
- **Genuinely on-device.** Zero network calls, zero bytes leave the phone, runs on a ₹8,000
  Android device with no accelerator.
- **Cold-start honest.** It works on the third occurrence of a mandate, not after enough
  data to train on.

If a judge asks **"where's the AI?"** — answer plainly: *"There isn't one, and that's a
design decision. Here's the arithmetic instead."* Do not hedge, and do not call a regex
"NLP."

### On the roadmap, honestly scoped

- A small on-device classifier for **merchant → category**, shipped as JSON weights with no
  native dependency and no network. It is the one place ML would beat what we have, because
  MCC resolution is our weakest link. Not in this build.
- **Account Aggregator** (RBI's consent framework — Setu, Finvu, Perfios) as the production
  ingestion rail. Statement import is the zero-integration wedge; AA is the regulated path,
  and it needs FIU status we do not have.

### What is simulated

Payments. TiXPay is not a PSP and holds no UPI licence, so confirming a payment applies a
debit to the local ledger and says **"SIMULATED — no money moved"** on the receipt. QR
scanning and `parseUpiDeepLink` are real — a genuine shop QR scans and resolves. The
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

281 tests across 15 files, under a second. Includes `appStore.test.ts`, which drives the
real app store through the whole demo headlessly — import, intercept, pay, rescue.

### The app, in a browser

```bash
node scripts/dev-web.mjs --port 8090
```

No device or emulator needed. Opens on the import screen; **"Try it with a sample
statement"** loads the bundled corpus.

### The app, on an Android device

```bash
pnpm --filter tixpay-mobile android
```

Or build the APK by hand:

```bash
cd apps/mobile/android && ./gradlew app:assembleDebug --console=plain
```

```bash
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### Typecheck everything

```bash
pnpm typecheck
```

---

## 🎬 Demo script

Every number below is produced by the engine from `fixtures/demo_statement.csv`. Nothing on
these screens is hardcoded — the engine test suite asserts these exact figures, so what you
see on stage is what CI checks.

**Moment 0 — the import (30 seconds, and it is the privacy pitch)**

Open the app. It starts on **Import your statement**, not on a dashboard, because there is
genuinely nothing to show before a file is chosen. Tap **Try it with a sample statement**.
The analysis screen reports what was actually read: *267 of 267 rows · HDFC ••4471 · 8
auto-debits found*.

> Say out loud: *"No SMS permission, no bank login, no network. One file, and it never
> leaves the phone."*

**Moment 1 — the intercept (the headline)**

1. Insights opens clear: balance **₹21,597**, lowest projected **₹4,900**, no shortfalls.
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
8. Confirm one. The curve re-projects for real, *Safe to Spend* jumps to **₹8,850**, and the
   jar visibly drops if you swept. Green means the projection genuinely cleared, not that a
   button was pressed.

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
│   │   │   ├── project/        # Ledger, income inference, 30-day balance curve
│   │   │   ├── guard/          # Shortfall finder & verified intervention search
│   │   │   ├── attribute/      # Failed-transaction cause classifier
│   │   │   ├── route/          # MCC resolver & card router
│   │   │   ├── evaluate/       # The pre-payment intercept
│   │   │   ├── pipeline.ts     # runPipeline / runPipelineFromStatement
│   │   │   └── types.ts        # The shared contract
│   │   ├── fixtures/           # demo_statement.csv — the synthetic demo corpus
│   │   └── test/               # 281 tests, including the app-store wiring suite
│   └── types/                  # Re-exports the engine contract (never a copy of it)
├── apps/
│   └── mobile/                 # React Native + Expo client
│       ├── src/screens/        # Insights, Pay, ShortfallSheet, MandateHub, Keeper, …
│       ├── src/data/           # The bundled sample statement (generated)
│       └── store/              # Zustand store — the only place UI meets engine
└── scripts/dev-web.mjs         # Browser preview launcher
```

Engine internals, algorithms and the maths: [`packages/engine/README.md`](packages/engine/README.md).

> **Note on the `PERSON_*_BRIEF.md` and `TIXPAY_BUILD_SPEC.md` files:** these are the
> original planning documents from the build, written when ingestion was SMS-based. They
> are kept as a record of how the project was scoped and split, and they do **not** describe
> the current build. This README and the engine README are the current documentation.
