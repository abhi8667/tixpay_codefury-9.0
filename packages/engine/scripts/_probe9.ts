import { useAppStore } from '../../../apps/mobile/store/useAppStore';
const s = () => useAppStore.getState();
s().loadSampleStatement();
const c = s()._pipelineCache!;
const dr = c.ledger.txns.filter(t=>t.direction==='DEBIT').map(t=>t.amount).sort((a,b)=>b-a);
console.log('top debits', dr.slice(0,12));
console.log('median debit', dr[Math.floor(dr.length/2)], 'count', dr.length);
const cr = c.ledger.txns.filter(t=>t.direction==='CREDIT').map(t=>({a:t.amount,h:t.merchantHint?.slice(0,40)}));
console.log('credits', JSON.stringify(cr));
