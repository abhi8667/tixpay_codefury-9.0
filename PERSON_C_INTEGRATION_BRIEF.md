# Person C — Integration, Build & Stage Lead

**TiXPay UPI · 24h hackathon · repo, state, native bridge, device, stage**

You are the only person who can single-handedly kill this project, and the only person who can save it. A and B produce parts. You produce the thing that runs.

---

## 0. Your one job

An APK, on a real Android phone, mirrored to a projector, that executes the demo without network, without a crash, and without a build error at hour 23.

Everything below serves that. If a task doesn't move you toward a working APK on a real device, it isn't yours.

---

## 1. Your two hard gates

Everything else is negotiable. These are not.

| Gate | Hour | If it fails |
|---|---|---|
| `types.ts` + `mocks.ts` committed | **1** | Person A is blocked and idles for six hours |
| Real SMS read proven on the demo device | **2** | Go seeded-only, tell the judges, move on — **do not keep fighting it** |
| Debug APK installs and launches | **6** | Stop feature work. This is now the only task in the room. |
| Feature freeze | **21** | Unfinished work becomes a roadmap bullet, not a late merge |

The hour-2 gate has a **hard stop**. If SMS reads aren't working two hours in, the `InboxSource` abstraction means you lose nothing by switching to seeded and the demo is unaffected. Teams lose hackathons by spending eight hours on a permission that was never load-bearing.

---

## 2. Hour 1: the contract

This is the highest-leverage hour of your 24. Two files, committed together.

### `packages/types/index.ts`

Copy the full data model from §4 of the build spec verbatim. Don't improvise it — A and B are both reading that section.

**After hour 3 this file is additive-only.** New optional fields are fine. Renaming or removing anything requires all three of you to stop and agree. A silent breaking change at hour 14 costs more than whatever feature it enabled.

### `packages/types/mocks.ts` — the thing people forget

Person A cannot build a single screen until fully-populated fixtures exist. B won't have real output until hour 7. Without mocks, A idles for six hours and you lose a quarter of your total capacity.

```ts
export const mockMandates: Mandate[] = [ /* 8 entries, mixed priority */ ];
export const mockCurve: BalanceCurve = [ /* exactly 30 points, dips negative on day 12 */ ];
export const mockShortfall: Shortfall = { /* deficit 3200, 2 at-risk mandates */ };
export const mockInterventions: Intervention[] = [ /* 3, each with a full resultingCurve */ ];
export const mockRecommendation: Recommendation = { /* CARD_SWIPE, fee-waiver reason */ };
```

Every field populated. Realistic Indian values. **`mockInterventions[].resultingCurve` must be a real 30-point array** — A's morph animation interpolates against it point-by-point and will silently do nothing if lengths mismatch.

Make the mock data tell the demo story. A builds the hero moment against this, so if the mock shortfall is boring, the screen A builds will be too.

---

## 3. Repo setup

```
pnpm init
# pnpm-workspace.yaml → packages/*, apps/*
```

Three packages: `packages/types`, `packages/engine` (B), `apps/mobile` (A + you).

**Rules you enforce:**
- `apps/mobile/views/**` may import from `packages/types` only — **never** from `packages/engine`
- `packages/engine` may import from `packages/types` only — never React, never anything native
- You own the seam. Both sides talk through your Zustand store and nowhere else.

Add a lint rule if you have five spare minutes; otherwise just check imports when you merge.

**Branching:** `main` + short-lived feature branches, merge often. Do not let anyone sit on a branch for six hours. With three people and 24 hours, integrate every two hours or you'll spend hours 20–23 in merge conflicts instead of rehearsing.

---

## 4. Native SMS bridge — the sharp edges

This is where the unfamiliar error messages live. Budget hour 1–2 and stop at the gate.

### Setup

```bash
npx create-expo-app apps/mobile --template blank-typescript
npx expo install expo-dev-client
pnpm add react-native-get-sms-android
```

`react-native-get-sms-android` has **no Expo config plugin**. You write one, or you use `expo-build-properties` plus a manual manifest injection. The plugin route:

```js
// plugins/withSmsPermission.js
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

module.exports = function withSmsPermission(config) {
  return withAndroidManifest(config, cfg => {
    AndroidConfig.Permissions.addPermission(cfg.modResults, 'android.permission.READ_SMS');
    AndroidConfig.Permissions.addPermission(cfg.modResults, 'android.permission.RECEIVE_SMS');
    return cfg;
  });
};
```

Register it in `app.json` under `plugins`. Then:

```bash
npx expo prebuild --clean
npx expo run:android
```

**Verify the permission actually landed** before writing any feature code:

```bash
grep READ_SMS android/app/src/main/AndroidManifest.xml
```

If that grep returns nothing, nothing downstream will work. This single command at hour 1 is worth more than any amount of debugging at hour 20.

### Runtime permission

**Request it behind a button, never on mount.** An unhandled denial on app open is a black screen in front of judges.

```tsx
const granted = await PermissionsAndroid.request(
  PermissionsAndroid.PERMISSIONS.READ_SMS
);
```

### `InboxSource` — build this before either implementation

```ts
export interface InboxSource { read(since: Date): Promise<RawSms[]> }

export class DeviceInbox implements InboxSource { /* SmsAndroid.list */ }
export class SeededInbox implements InboxSource { /* bundled demo_inbox.json */ }
```

Toggle in Settings. This abstraction is your entire insurance policy — with it, the hour-2 gate failing costs you a talking point, not a demo.

### Device gotchas

- **MIUI / ColorOS / Funtouch** have a *second* SMS-and-autostart permission buried in the OEM settings that the standard prompt does not cover. Grant it manually tonight and never revoke it.
- **Disable battery optimisation** for the app, or a background parse gets killed mid-demo.
- Some skins shunt bank SMS into a separate "Transactions" bucket. If your counts look low, query `box: 'all'` instead of `box: 'inbox'`.

---

## 5. Hour 2: dump the inbox, measure, report

Run once from the dev client. Then never touch the device for development again.

```ts
// scripts/dump-inbox.ts
const msgs = await SmsAndroid.list({ box: 'inbox', maxCount: 5000 });
// keep only: address, body, date — drop everything else
writeFile('packages/engine/fixtures/real_inbox.json', JSON.stringify(msgs));
```

Share the file to B immediately. B then develops against it under `vitest` on a laptop for the rest of the hackathon.

**Run `measure.ts` and report three numbers to the team out loud:**

| Number | Decision it forces |
|---|---|
| % of financial SMS parsed | Below 70% → B cuts to the top two banks and hardcodes |
| Distinct bank sender IDs present | B ignores every format not in this list |
| Mandate candidates found | Below 3 → the discovery moment falls flat, see below |

**If fewer than 3 real mandates:** blend. Load the real inbox, inject 4–5 synthetic mandate threads dated into the actual timeline. Still visually a real inbox, still an honest claim provided you say "plus a few injected for coverage" on stage.

---

## 6. Zustand store — the seam

One store. Selectors call B's pure functions; components consume selectors. Neither side knows the other exists.

```ts
interface AppState {
  // raw
  rawSms: RawSms[];
  inboxMode: 'real' | 'seeded';
  now: Date;                      // ← the World Clock drives this
  pausedMandateIds: string[];
  redactionOn: boolean;

  // derived (memoised)
  transactions: () => Transaction[];
  mandates: () => Mandate[];
  curve: () => BalanceCurve;
  shortfalls: () => Shortfall[];
  interventions: (s: Shortfall) => Intervention[];

  // actions
  setNow: (d: Date) => void;
  injectSms: (raw: RawSms) => void;
  applyIntervention: (i: Intervention) => void;
  loadScenario: (name: 'healthy' | 'tight' | 'bounce') => void;
}
```

**`now` flows from the store into every engine call.** B has been told never to call `new Date()` internally — you are the one who enforces it. Grep the engine for `new Date()` before every merge you accept. If one slips through, the World Clock silently does nothing and you'll find it at hour 18.

**Memoise the derived chain.** Parsing 400 SMS on every slider tick will drop frames during A's animation. Cache on `[rawSms, now, pausedMandateIds]`.

**Ask B for `runPipeline(inbox, now)` early.** A single convenience function lets you wire the entire chain at hour 4, before the individual pieces are done. Then B's improvements flow through automatically with no integration work.

---

## 7. Simulator wiring

A builds the dashboard UI. You make it do things.

- **World Clock slider** → `setNow(date)` → everything recomputes downstream
- **Scenario presets** → `loadScenario()` swaps the seeded corpus and resets `now`
- **SMS injector** → `injectSms()` appends to `rawSms`, triggers re-derivation, fires a toast
- **Fake checkout** → merchant chip + amount → `recommendInstrument()` → banner

Test each preset at least twice. A judge will ask "what if they get paid earlier?" and you want to answer by tapping, not talking.

---

## 8. Build pipeline

```bash
npx expo prebuild --clean
eas build -p android --profile preview --local
```

- **`--local` is not optional.** EAS cloud queues run 20–40 minutes during hackathon crunch. Local Gradle is ~4 minutes once warm.
- **`eas.json` → `preview` profile must set `"buildType": "apk"`.** The default is `app-bundle`, which produces an `.aab` you **cannot sideload**. This catches people every single time.
- **Build a debug APK at hour 6**, even with placeholder screens. Discovering the manifest problem at hour 22 is a project-ending bug and there is no recovery.
- Throwaway keystore, committed to the repo. Hackathon only — say so in the README.
- `targetSdk 34`, `minSdk 26`.

**Distribution:** final APK on a **USB stick** and a QR-coded Drive link. Venue wifi will fail; plan for it as a certainty, not a risk.

---

## 9. Privacy — you enforce, A implements

A real inbox goes on a projector in front of strangers and is probably recorded.

A builds the redaction layer in the render path. **Your job is the audit.**

**Tonight, before the hackathon starts:** scroll the demo phone's inbox manually, end to end. Confirm there is nothing — OTPs, personal messages, medical, financial detail you'd regret — that would be catastrophic flashing on screen during a scroll animation.

Ship with redaction **ON** by default. Verify it's on before you hand the phone to anyone.

Pitch line you should make sure gets said: *nothing leaves the device; the app makes zero network calls.* That's already true of the architecture — make sure it's stated.

---

## 10. Stage setup

**`scrcpy` over USB.** Free, near-zero latency, indifferent to venue HDMI.

```bash
scrcpy --stay-awake --turn-screen-off=false --max-size 1080
```

Test it on the actual projector before you need it. Rehearse the cable routing — a phone on a short USB cable, three metres from a laptop, is a real physical problem people discover on stage.

**Phone prep, hour 22:**
- Airplane mode ON (proves the no-network claim *and* prevents a notification banner mid-demo)
- Do Not Disturb ON
- Brightness at maximum
- Screen timeout to 10 minutes
- Battery optimisation off for the app
- App already launched and warm

**Rehearse twice, end to end, on the projector.** Not once. The second run is where you find the thing the first run's adrenaline hid.

---

## 11. Demo script — you drive

| # | Beat | Say |
|---|---|---|
| 1 | Mandate Hub, real inbox | *"This is my actual phone."* — **pause 5 seconds, let it land** |
| 2 | Tap a mandate | *"Found from six messages. No bank login, no integration."* |
| 3 | Switch to seeded | *"Switching to a simulated month so you can see the failure case."* |
| 4 | Calendar, curve dips red | *"Their SIP fails here. NACH bounce charge, ₹250, plus a missed investment."* |
| 5 | Tap the dip | — |
| 6 | Tap "Pause Netflix" | Curve flattens green, haptic. *"₹250 avoided. One tap."* |
| 7 | Simulator → checkout, ₹8,000 at Croma | *"Don't use UPI. Swipe the Amex — you're ₹4,000 from your fee waiver."* |
| 8 | Constraints slide | Own them out loud, before anyone asks |

Beat 3 matters. **Announce the switch to simulated data.** Judges respect it, and being caught mid-demo pretending synthetic data is real is unrecoverable.

---

## 12. Answers to have ready

- **"Can you actually pause a UPI mandate?"** — No. Not without being a licensed PSP. We show the intervention; execution requires a PSP partnership. On the roadmap slide.
- **"How do you know the balance?"** — We don't. It's a shadow ledger inferred from SMS and reconciled against stated balances. Our drift is ₹X. *(Get the real number from B.)*
- **"READ_SMS is restricted on Play Store."** — Correct, for non-default-SMS apps. Production path is the RBI Account Aggregator framework or an on-device notification listener. SMS is the zero-integration prototype.
- **"Why not just use the bank's app?"** — Banks show one account's mandates. This is cross-bank, cross-instrument, and forward-looking. No bank shows you a projected balance curve against your own debits.
- **"Only RuPay works on UPI."** — Right, which is why the router's real output is *which rail*, not which card.

---

## 13. Traps

- **Merging late.** Every two hours, no exceptions. Three people, one repo, 24 hours — merge debt compounds fast.
- **`buildType` defaulting to app-bundle.** You get an `.aab`. You cannot sideload it. You find out at hour 23.
- **Fighting SMS past hour 2.** The abstraction exists so you don't have to. Use it.
- **No memoisation on derived state.** The World Clock slider will drop frames and A will blame their animation.
- **Testing only on emulator.** Get the app on the real demo device by hour 8. Reanimated timing and SVG rendering differ, and the phone may have a 120Hz panel or a notch that changes everything.
- **Skipping the second rehearsal.** This is the one people cut when they're behind, and it's the one that catches the demo-breaking bug.
