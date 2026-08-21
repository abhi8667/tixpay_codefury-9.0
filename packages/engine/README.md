# `@tixpay/engine` — Analytical & Predictive Engine

> **Zero-integration, on-device cash-flow guard for UPI users.**
> Built with pure TypeScript, zero platform/UI dependencies, and deterministic time-travel testing.

---

## 📋 Table of Contents

1. [Architecture & Design Principles](#1-architecture--design-principles)
2. [Implemented Features & Business Logic](#2-implemented-features--business-logic)
   - [Phase 1: Foundation & UPI DeepLink Parser](#21-foundation--upi-deeplink-parser)
   - [Phase 2: Bank SMS Parser & Mandate Discovery](#22-bank-sms-parser--mandate-discovery)
   - [Phase 3: Shadow Ledger & Forward Balance Curve](#23-shadow-ledger--forward-balance-curve)
   - [Phase 4: Guard, Attribution, Router & Pre-Payment Intercept](#24-guard-attribution-router--pre-payment-intercept)
   - [Phase 5: The Grand Pipeline Integration](#25-the-grand-pipeline-integration)
3. [Module-by-Module Technical Deep Dive](#3-module-by-module-technical-deep-dive)
4. [Testing & Scenario Verification](#4-testing--scenario-verification)

---

## 1. Architecture & Design Principles

The `@tixpay/engine` package is built to satisfy strict architectural invariants:

- **100% Pure TypeScript:** Zero React, zero React Native, zero Android/iOS native dependencies. Can run in Node.js, Bun, Web Workers, or React Native JS runtime.
- **Deterministic Time-Travel Architecture:** No function inside the engine logic calls `new Date()` without arguments. Every function accepts an explicit `now: Date` parameter. This allows the simulator and world-clock slider to shift "today" forward/backward deterministically.
- **Fail-Safe & Non-Throwing:** The engine never throws unhandled exceptions. Malformed SMS, unrecognized VPAs, or invalid URLs return `null` or `{ confidence: 0 }`.
- **Paise Integer Accumulation:** While the public interface exports amounts in Rupees (2dp), internal accumulation and projections are computed in paise integers to eliminate floating-point rounding errors.
- **IST Timezone Awareness (+5:30):** All day-key calculations (`YYYY-MM-DD`) and calendar offsets are evaluated against Indian Standard Time (IST) to prevent UTC midnight boundary shifts.

---

## 2. Implemented Features & Business Logic

### 2.1 Foundation & UPI DeepLink Parser
- **UPI QR Code Parser (`src/parse/deepLink.ts`):** Parses genuine merchant QR deep links (`upi://pay?pa=...&am=...&mc=...` and Android `intent://` wrappers). Extracts `vpa`, `payeeName`, `amount`, and `mcc` (Merchant Category Code). Generates deterministic transaction references (`TPxxxxxxx`).

### 2.2 Bank SMS Parser & Mandate Discovery
- **Bank SMS Regex Extractor (`src/parse/sms.ts`):** Parses SMS headers from 6 major Indian banks (`HDFCBK`, `SBIINB`, `ICICIB`, `KOTAKB`, `AXISBK`, `PNBSMS`) by matching trailing 6-character telecom entity headers (ignoring `AD-`/`VM-` prefixes and `-S`/`-T` suffixes).
  - Extracts `direction` (`DEBIT` vs `CREDIT`), `amount`, `vpa`, `accountTail`, `balanceHint`, `refNo`, and `isFailure`.
  - Rejects noise early (OTPs, promotional SMS, future debit notices, statement alerts).
- **Mandate Discovery Engine (`src/detect/mandates.ts`):** Discovers recurring auto-debits without bank APIs.
  - Normalizes VPAs by stripping order numbers and transaction handles (`swiggy.payu.98241@hdfcbank` → `swiggy.payu@hdfcbank`).
  - Buckets transactions by `(normalizedVpa, amount ±5%)`.
  - Computes consecutive inter-arrival day gaps and takes the **median gap** (28–31d = `MONTHLY`, 6–8d = `WEEKLY`, 89–92d = `QUARTERLY`).
  - Requires $\ge 3$ occurrences and computes confidence score $C = 0.6 \times \text{countScore} + 0.4 \times \text{varianceScore}$.
  - Ranks mandates into domain categories & priorities:
    $$\text{EMI (Critical)} > \text{SIP (Critical)} > \text{Insurance (High)} > \text{Utility (Medium)} > \text{OTT (Low)}$$

### 2.3 Shadow Ledger & Forward Balance Curve
- **Shadow Ledger (`src/project/ledger.ts`):** Reconstructs account balance chronologically from debit/credit transactions. Snaps to `balanceHint` values whenever a bank SMS states `Avl Bal`, measuring and reporting historical balance `drift`.
- **Income Inference (`src/project/income.ts`):** Detects recurring credit streams:
  - **Salaried Income:** Fixed amount ($\pm 5\%$) landing on the same day of month ($\pm 2$ days).
  - **Irregular Income:** Variable freelance payouts evaluated over a rolling window.
- **30-Day Forward Balance Projection (`src/project/curve.ts`):** Emits an exact 30-point `BalancePoint` array starting from `now`. Applies recurring mandates and projected income events on their future due dates. Supports `projectWithPaused` for instant UI re-animation on intervention.

### 2.4 Guard, Attribution, Router & Pre-Payment Intercept
- **Bounce Guard (`src/guard/index.ts`):**
  - `findShortfalls()`: Scans the balance curve for contiguous days dipping below the ₹500 safety buffer. Maps all mandates at risk.
  - `proposeInterventions()`: Evaluates candidate remedies. Generates **SWEEP** (transfer funds in) or **PAUSE** (defer non-critical mandates like Netflix) to rescue critical SIPs/EMIs.
- **Cause Attribution (`src/attribute/index.ts`):** `classifyFailure()` checks if historical failures were due to `LIQUIDITY` (balance < debit amount) or `INTENTIONAL` (user stopped it). Returns `UNKNOWN` if no balance hint exists within 7 days.
- **Smart Payment Router (`src/route/index.ts`):** 
  - `resolveMcc()`: Matches VPA against `data/vpa_patterns.json` regex map or uses QR `mc` param.
  - `recommendInstrument()`: Evaluates user cards against category exclusions, reward caps, and fee-waiver proximity. Advises **card swipe over UPI** if the user is close to an annual fee waiver.
- **Pre-Payment Intercept (`src/evaluate/index.ts`):** The headline API `evaluatePayment()`.
  - Simulates a payment by cloning the shadow ledger and adding a hypothetical debit at `now`.
  - Compares shortfalls between the original timeline and hypothetical timeline.
  - Detects if the payment creates a new shortfall or pulls an existing shortfall earlier.
  - Returns a `WARNING` or `ADVISORY` verdict with human-readable headlines (*"This moves your shortfall from 12 March to 7 March. Your ₹1,899 LIC Premium will bounce earlier."*).

### 2.5 The Grand Pipeline Integration
- **Unified Entry Point (`src/pipeline.ts`):** `runPipeline(inbox, now)` executes all 4 phases and returns a single unified `PipelineResult` containing `txns`, `ledger`, `mandates`, `income`, `curve`, `shortfalls`, `interventions`, and `stats`. Binds directly into Person C's Zustand store.

---

## 3. Module-by-Module Technical Deep Dive

| Directory / File | Key Function | Responsibility |
|---|---|---|
| `src/types.ts` | — | Domain interfaces & shared data contracts |
| `src/money.ts` | `toPaise`, `parseAmount` | Safe currency conversion & Indian lakh grouping |
| `src/time.ts` | `istDayKey`, `formatIstDate` | IST timezone conversions & date formatting |
| `src/parse/sms.ts` | `parseSms()` | Indian bank SMS regex extraction pipeline |
| `src/parse/deepLink.ts` | `parseUpiDeepLink()` | Standard UPI intent & QR code parser |
| `src/detect/mandates.ts` | `detectMandates()` | Median-gap recurring mandate discovery |
| `src/project/ledger.ts` | `buildLedger()` | Reconstructed shadow ledger & drift calculation |
| `src/project/income.ts` | `inferIncomeEvents()` | Salary & irregular freelance credit detection |
| `src/project/curve.ts` | `projectBalance()` | 30-day forward balance curve generation |
| `src/guard/index.ts` | `proposeInterventions()` | Shortfall detection & one-tap remedies |
| `src/attribute/index.ts` | `classifyFailure()` | Failed transaction cause attribution |
| `src/route/index.ts` | `recommendInstrument()` | MCC resolution & credit card optimization |
| `src/evaluate/index.ts` | `evaluatePayment()` | Headline pre-payment hypothetical intercept |
| `src/pipeline.ts` | `runPipeline()` | Single-entry pipeline for app state integration |

---

## 4. Testing & Scenario Verification

### Automated Unit & Integration Tests
Run the entire Vitest suite (15 test files, 253 tests):
```bash
pnpm --filter @tixpay/engine test
```

Strict TypeScript check:
```bash
pnpm --filter @tixpay/engine typecheck
```

### Live Demo Pitch Scenario Script
Run the automated pitch script that simulates the live 2-minute stage presentation:
```bash
pnpm --filter @tixpay/engine exec tsx scripts/use_case_demo.ts
```
