import { useAppStore } from '../../../apps/mobile/store/useAppStore';
const s = () => useAppStore.getState();
s().loadSampleStatement();
console.log('map', JSON.stringify(s().moneyMap(), null, 1));
console.log('verdict', JSON.stringify(s().healthVerdict(), null, 1));
console.log('subs', JSON.stringify(s().subscriptions()?.charges.map(c=>({l:c.label,a:c.amount,c:c.cadence,y:c.annualCost})), null, 1));
