/**
 * TiXPay shared contract.
 *
 * A single re-export of the engine's own type declarations — deliberately not a
 * copy of them.
 *
 * This file used to restate the contract by hand, and the two drifted: the
 * engine dropped the SMS payload from `Transaction` during the move to
 * statement import, this copy kept it, and every screen typed against the stale
 * shape while running on the new one. Re-exporting makes that impossible.
 *
 * The relative path is intentional. `@tixpay/engine` would resolve through the
 * workspace and make this package depend on package-manager state; a relative
 * import inside the same repo always resolves.
 */
export * from '../engine/src/types';
