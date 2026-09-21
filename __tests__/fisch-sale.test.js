const { mutationTable, fishValue, selectModifier, sizeLabel } = require('../Code/Helper/fishRules');
const fish = { base_value: 100, base_weight: 10, weight_range: 8 };
const table = mutationTable([
  { name: 'Shiny', type: 'Attributes', value: 1.85 }, { name: 'Sparkling', type: 'Attributes', value: 1.85 },
  { name: 'Glitched', type: 'Attributes', value: 0 }, { name: 'Midas', value: 2 },
  { name: 'Putrid', value: -0.5 }, { name: 'Surreal', value: [0, 8] }, { name: 'Sizes', value: [1, 2] },
]);
test('one mutation can coexist with supported attributes', () => {
  const picked = selectModifier(['Midas', 'Shiny'], 'Putrid', table);
  expect(picked).toEqual(['Shiny', 'Putrid']);
  expect(fishValue(fish, 10, ['Midas', 'Putrid'], table).error).toBeTruthy();
  expect(fishValue(fish, 10, ['Midas', 'Shiny', 'Sparkling'], table).value).toBe(685);
});
test('zero, negative and variable multipliers are preserved', () => {
  expect(fishValue(fish, 10, ['Glitched'], table).value).toBe(0);
  expect(fishValue(fish, 10, ['Putrid'], table).value).toBe(-50);
  expect(fishValue(fish, 10, ['Surreal'], table).range).toEqual({ min: 0, max: 800 });
  expect(table.Sizes).toBeUndefined();
});
test('actual overweight catches work and invalid inputs cannot produce a sale value', () => {
  expect(sizeLabel(fish, 15)).toBe('Big');
  expect(sizeLabel(fish, 20)).toBe('Giant');
  expect(fishValue(fish, 100, [], table).value).toBe(1000);
  for (const weight of [0, -1, Infinity, 'abc']) expect(fishValue(fish, weight, [], table).value).toBeNull();
  expect(fishValue(fish, 10, ['unknown'], table).error).toBeTruthy();
});
