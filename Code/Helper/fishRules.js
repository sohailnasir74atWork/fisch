/* NPC sale estimates only. Market premiums are never inferred from these multipliers. */
function mutationTable(rows) {
  const table = {};
  for (const row of rows || []) {
    if (!row?.name || row.name === 'Sizes' || row.modifierKind === 'size') continue;
    const raw = Array.isArray(row.value) ? row.value : [row.value];
    if (!raw.length || raw.some(v => v == null || v === '' || !Number.isFinite(Number(v)))) continue;
    const values = raw.map(Number);
    table[row.name] = { kind: row.modifierKind || (row.type === 'Attributes' ? 'attribute' : 'mutation'),
      min: Math.min(...values), max: Math.max(...values) };
  }
  return table;
}
function selectModifier(picked, name, table) {
  if (picked.includes(name)) return picked.filter(n => n !== name);
  if (!table[name]) return picked;
  return [...picked.filter(n => table[name].kind !== 'mutation' || table[n]?.kind !== 'mutation'), name];
}
function fishValue(fish, weight, names = [], table = {}) {
  const base = Number(fish?.base_value), divisor = Number(fish?.base_weight), kg = Number(weight);
  const invalid = error => ({ value: null, range: null, error, applied: {}, unknown: [], perKg: null });
  if (fish?.base_value == null || !Number.isFinite(base) || !Number.isFinite(divisor) || divisor <= 0 || !Number.isFinite(kg) || kg <= 0) return invalid('Enter a valid fish and weight above zero.');
  const selected = [...new Set(names)];
  if (selected.some(n => !table[n])) return invalid('A selected modifier has no supported sale rule.');
  if (selected.filter(n => table[n].kind === 'mutation').length > 1) return invalid('A catch can have only one mutation.');
  const perKg = base / divisor, initial = Math.ceil(perKg * kg);
  let low = initial, high = initial; const applied = {};
  for (const name of selected) {
    const r = table[name], candidates = [low*r.min,low*r.max,high*r.min,high*r.max];
    low = Math.min(...candidates); high = Math.max(...candidates);
    applied[name] = r.min === r.max ? r.min : [r.min,r.max];
  }
  low = Math.ceil(low); high = Math.ceil(high);
  return { value: low === high ? low : null, range: low === high ? null : { min:low,max:high },
    error: null, applied, unknown: [], perKg, unit:'C$' };
}
function weightRange(fish) {
  const max = Number(fish?.base_weight), span = Number(fish?.weight_range);
  if (!Number.isFinite(max) || max <= 0) return null;
  const min = Number.isFinite(span) ? Math.max(0,max-span) : max;
  return { min,max,avg:(min+max)/2 };
}
function sizeLabel(fish, weight) {
  const base = Number(fish?.base_weight), kg = Number(weight);
  if (!(base > 0 && kg > 0)) return null;
  if (kg > base * 1.99) return 'Giant';
  if (kg > base) return 'Big';
  return null;
}
function formatFishValue(n) {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if(a>=1e9) return (n/1e9).toFixed(2)+'B';
  if(a>=1e6) return (n/1e6).toFixed(2)+'M';
  if(a>=1e3) return (n/1e3).toFixed(1)+'K';
  return n.toLocaleString('en-US',{maximumFractionDigits:2});
}
module.exports={mutationTable,selectModifier,fishValue,weightRange,sizeLabel,formatFishValue};
