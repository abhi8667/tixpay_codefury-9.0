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
├── TIXPAY_BUILD_SPEC.md        # Master 24h hackathon build specification
├── PERSON_A_UI_BRIEF.md        # Person A (UI & Visual Lead) brief
├── PERSON_B_ENGINE_BRIEF.md    # Person B (Feature Logic & Engine Lead) brief
└── PERSON_C_INTEGRATION_BRIEF.md # Person C (Integration & Bridge Lead) brief
```

---

## ⚡ Quick Start & Verification

### Install Dependencies
```bash
pnpm install
```

### Run Engine Typecheck
```bash
pnpm --filter @tixpay/engine typecheck
```

### Run Engine Vitest Test Suite (253 tests)
```bash
pnpm --filter @tixpay/engine test
```

### Run Automated Live Pitch Demo Script
```bash
pnpm --filter @tixpay/engine exec tsx scripts/use_case_demo.ts
```

---

## 📄 Documentation

For an in-depth technical breakdown of the algorithms, mathematical models, and engine pipeline, see [`packages/engine/README.md`](file:///c:/Hacks/tixpay_codefury-9.0/packages/engine/README.md).
