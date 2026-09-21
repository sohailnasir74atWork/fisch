import { tradePerspective } from '../Code/Trades/tradePerspective';
const trade = { userId: 'owner', hasItems: [{ name: 'A' }], wantsItems: [{ name: 'B' }] };
const snapshot = verdict => ({ has: { total: 100 }, wants: { total: 150 }, evaluation: { status: 'complete', verdict } });
test.each([['win', 'lose'], ['lose', 'win'], ['fair', 'fair']])('viewer sees %s as %s with matching sides', (owner, viewer) => {
  const saved = snapshot(owner);
  const result = tradePerspective(trade, saved, 'buyer');
  expect(result.evaluation.verdict).toBe(viewer);
  expect(result.giveItems).toBe(trade.wantsItems);
  expect(result.receiveItems).toBe(trade.hasItems);
  expect(result.giveTotal).toBe(150);
  expect(result.receiveTotal).toBe(100);
  expect(saved.evaluation.verdict).toBe(owner);
});
test('owner retains calculator perspective; guests use buyer perspective', () => {
  expect(tradePerspective(trade, snapshot('win'), 'owner')).toMatchObject({ own: true, giveTotal: 100, receiveTotal: 150, evaluation: { verdict: 'win' } });
  expect(tradePerspective(trade, snapshot('win'), null).evaluation.verdict).toBe('lose');
  expect(tradePerspective({}, null, null).own).toBe(false);
});
test.each(['incomplete', 'open', 'empty'])('%s remains unevaluated', status => {
  expect(tradePerspective(trade, { ...snapshot(null), evaluation: { status, verdict: null } }, 'buyer').evaluation).toEqual({ status, verdict: null });
});
