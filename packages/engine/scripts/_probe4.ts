import { useAppStore } from '../../../apps/mobile/store/useAppStore';
const s = () => useAppStore.getState();
s().loadSampleStatement();
console.log('bal', s().ledger()?.currentBalance, 'keeper', s().keeperBalance);
for (let i = 0; i < 4; i++) {
  s().addToKeeper(500);
  console.log(i, 'keeper', s().keeperBalance, 'bal', s().ledger()?.currentBalance, 'simTxns', s().simulatedTxns.length, 'ids', s().simulatedTxns.map(t=>t.id));
}
for (let i = 0; i < 3; i++) {
  s().withdrawFromKeeper(500);
  console.log('w', i, 'keeper', s().keeperBalance, 'bal', s().ledger()?.currentBalance, 'sim', s().simulatedTxns.length);
}
