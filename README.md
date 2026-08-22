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
