# TiXPay UPI — On-Device Cash-Flow Guard

> **24h Hackathon Concept Build · React Native + Expo + Pure TypeScript**

TiXPay is an on-device, zero-integration cash-flow guard for UPI users. It reads the phone's SMS inbox, discovers recurring auto-debits without any bank API, projects a forward balance curve, and warns the user *before* a debit bounces — offering one-tap interventions at the moment of decision.

---

## 🚀 Key Features Implemented

1. **Pre-Payment Intercept (`evaluatePayment`)**
   - Scans merchant QR codes (`upi://pay?...`) and evaluates the payment's blast radius on the user's 30-day forward balance curve.
   - Warns if a payment creates a new shortfall or pulls an existing shortfall earlier.
   - Recommends alternative rails (e.g. *"Swipe your Visa Signature card instead — you're ₹4,000 from your fee waiver"*).

2. **Mandate Hub (SMS → Recurring Auto-Debits)**
   - Automatically detects monthly, weekly, and quarterly auto-debits using median inter-arrival gap logic ($C = 0.6 \times \text{countScore} + 0.4 \times \text{varianceScore}$).
   - Ranks debits into domain categories: EMI, SIP, Insurance, Utility, and OTT.

3. **Cash-Flow Calendar & 30-Day Projection**
   - Reconstructs a shadow ledger from SMS credit/debit notices, reconciled whenever a message contains a balance hint.
   - Infers salaried and irregular freelance income streams.
   - Emits a 30-point daily balance curve starting from `now`.

4. **Bounce Guard & One-Tap Interventions**
   - Identifies shortfalls dipping below the ₹500 safety buffer.
   - Proposes one-tap remedies (e.g., **Pause Netflix ₹649** or **Sweep ₹1,500**) and pre-calculates the rescued balance curve for instant UI animation.

---

## 🧠 How the intelligence works — and what it is not

TiXPay contains **no machine-learning model, no neural network, and no LLM.** There are
no model weights in this repo, no inference runtime, and no API keys. This is deliberate,
and it is worth saying out loud before anyone asks.

What the engine actually is: a **deterministic statistical inference layer** over the SMS
inbox. Every "insight" the app shows is arithmetic you can read, step through, and unit-test.

| Feature | What people assume | What it actually is |
|---|---|---|
| Recurring-debit discovery | Sequence model / clustering | Group by normalised VPA + amount (±5% band), take the **median inter-arrival gap**, bucket it (28–31d → MONTHLY, 6–8d → WEEKLY, 89–92d → QUARTERLY). Confidence = `0.6·countScore + 0.4·varianceScore`. |
| SMS understanding | NLP / entity extraction model | Bank-specific regex over a fixed template set, with a hand-labelled fixture corpus as the regression suite. |
| Merchant category (MCC) | Classifier | VPA-string heuristics + a seed lookup table, every result carrying an explicit confidence score. |
| Balance projection | Time-series forecasting | A shadow ledger replayed forward over detected mandates and inferred income events. Pure accounting. |
| Interventions | Recommender system | Constraint search: find the smallest set of pauses/sweeps/shifts that lifts the curve back above the ₹500 buffer. |

### Why this is the right call here, not a shortcut

- **Auditable.** When the app says *"your ₹5,000 SIP bounces on the 9th,"* we can show the
  exact three SMS messages and the median gap that produced it. A model can't do that, and
  in personal finance an unexplainable number is a number nobody acts on.
- **Deterministic.** Same inbox, same `now`, same output — every time. That is why the
  entire engine is covered by **253 tests that run in milliseconds** instead of by
  eyeballing an APK. No drift, no retraining, no silent regression.
- **Genuinely on-device.** Zero network calls, zero bytes leave the phone, and it runs on a
  ₹8,000 Android device with no accelerator. An on-device model would cost tens of MB and a
  native runtime; a cloud model would break the privacy claim that is the whole product.
- **Cold-start honest.** It works on message #3, not after enough data to train on.

### Stage line

> *"There's no model in this app. Recurring-debit detection is a median-gap statistic,
> parsing is regex over bank templates, and the projection is a replayed ledger — all
> deterministic, all on-device, all covered by 253 tests. We chose that over ML because a
> financial warning a user can't audit is a warning they won't act on. The one place a
> model would genuinely beat us is merchant categorisation, where we're currently on
> heuristics — that's on the roadmap slide, not in this build."*

If a judge asks **"where's the AI?"** — answer plainly: *"There isn't one, and that's a
design decision. Here's the arithmetic instead."* Do not hedge, and do not call regex
"NLP."

### On the roadmap, honestly scoped

A small on-device classifier for **merchant → category** is the one place ML would beat
what we have today, because §1.3 of the build spec already admits MCC resolution is our
weakest link. It would ship as JSON weights with no native dependency and no network. It
is not in this build.

---

## ⚡ How to Run

### 1. Prerequisites & Installation
Ensure Node.js (v18+) and `pnpm` are installed. From the workspace root:

```bash
pnpm install
```

---

### 2. Running the React Native Mobile App (Expo Metro)

To launch the Metro bundler and open the mobile app in your browser or Expo Go:

```bash
# Start Metro Dev Server
pnpm --filter tixpay-mobile start

# Or launch directly in Web Preview
pnpm --filter tixpay-mobile web
```

---

### 3. Building & Running Native Android App (Device / Android Studio)

To compile the native Android Debug APK and install it directly onto a connected physical Android device or emulator:

#### **A. Clean & Build Debug APK**
```powershell
# Navigate to native android directory
cd apps/mobile/android

# Clean build cache
./gradlew clean

# Compile Native Debug APK
./gradlew app:assembleDebug --console=plain
```

#### **B. Install APK to Connected Device (via ADB)**
```powershell
# Install the generated APK onto connected Android device
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

### 4. Running Engine Tests & Live Pitch Harness

```bash
# Run TypeScript Typecheck across all workspace packages
pnpm --filter tixpay-mobile typecheck
pnpm --filter @tixpay/engine typecheck

# Run Full Vitest Test Suite (253 tests across 15 test files)
pnpm --filter @tixpay/engine test

# Run Automated Live Pitch Demo Script
pnpm --filter @tixpay/engine exec tsx scripts/use_case_demo.ts
```

---

## 🎬 Demo script

Every number below is produced by the engine from `fixtures/demo_inbox.json` — nothing on
these screens is hardcoded. The app opens on **26 March 2026** because that is the date
where the guard has something to *not* warn about; a guard that fires on every amount is a
guard nobody believes.

**Moment 1 — the intercept (the headline)**

1. Open the app. Insights shows a clear curve: balance ₹21,597, lowest projected ₹4,900,
   no shortfalls. *"Right now this person is fine."*
2. Pay → **Scan QR** (or use the merchant already loaded). Type **₹500**. Amber:
   *"Better paid by card — swipe your Amex SmartEarn."* No panic, just a better rail.
3. Type **₹2,500**. Still amber. The guard is quiet because there is nothing to warn about.
4. Type **₹8,000**. Red:
   > **This leaves you ₹3,600 short on 7 April.**
   > Your ₹1,899 LIC Premium will bounce.

   Three at-risk debits listed underneath: LIC Premium, BESCOM Electricity, Netflix.

   The point to make out loud: *the verdict is recomputed on every keystroke.* Ask a judge
   to type their own number.

**Moment 2 — the resolution**

5. Tap **Pay anyway**. A debit SMS lands and the ledger reconciles to ₹13,597.
6. Back on Insights, the curve now dips to **−₹3,100** with a shortfall on 6 April.
7. Tap the dip. The engine offers what it actually computed — a ₹4,500 sweep, or pausing a
   mandate — each with the rescued curve precomputed.
8. Confirm one. The curve re-projects for real; green means the projection genuinely
   cleared, not that a button was pressed.

**Scenario presets** (Simulator → the three buttons) are dates, not doctored inboxes:

| Preset | Date | What it shows |
|---|---|---|
| `healthy` | 13 Mar | Flat and clear. Nothing warns. |
| `tight` | 26 Mar | **Default.** Clear on open; ₹8,000 creates a fresh shortfall. |
| `bounce` | 1 Mar | Already short on the 11th — Insights opens on a red dip. |

Moving the World Clock is the only thing that changes between them. No SMS is fabricated to
make a demo work, which is the answer to *"is this rigged?"*

---

## 📁 Repository Structure

```
tixpay/
├── packages/
│   └── engine/                 # @tixpay/engine (Pure TS analytical core)
│       ├── src/
│       │   ├── parse/          # Bank SMS & UPI QR deep link parsers
│       │   ├── detect/         # Median-gap recurring mandate discovery
│       │   ├── project/        # Shadow ledger, income inference, 30-day balance curve
│       │   ├── guard/          # Shortfall finder & intervention proposals
│       │   ├── attribute/      # Failed transaction cause classifier
│       │   ├── route/          # MCC resolver & credit card router
│       │   ├── evaluate/       # Headline pre-payment intercept engine
│       │   ├── pipeline.ts     # Grand pipeline entry point (runPipeline)
│       │   └── types.ts        # Shared data contract
│       ├── fixtures/           # Hand-labelled SMS cases & 468-message demo corpus
│       ├── scripts/            # Synthetic inbox generator & use-case pitch demo script
│       └── test/               # Vitest test suite (15 test files, 253 passing tests)
├── apps/
│   └── mobile/                 # React Native + Expo Mobile Client App
│       ├── src/
│       │   ├── screens/        # Insights, MandateHub, PayScreen, ShortfallSheet, Simulator
│       │   └── components/     # Header, BottomTabBar, DevSkipToggle
│       └── store/              # Central Zustand App Store (useAppStore)
├── TIXPAY_BUILD_SPEC.md        # Master 24h hackathon build specification
├── PERSON_A_UI_BRIEF.md        # Person A (UI & Visual Lead) brief
├── PERSON_B_ENGINE_BRIEF.md    # Person B (Feature Logic & Engine Lead) brief
└── PERSON_C_INTEGRATION_BRIEF.md # Person C (Integration & Bridge Lead) brief
```

---

## 📄 Documentation

For an in-depth technical breakdown of the algorithms, mathematical models, and engine pipeline, see [`packages/engine/README.md`](file:///c:/Hacks/tixpay_codefury-9.0/packages/engine/README.md).
