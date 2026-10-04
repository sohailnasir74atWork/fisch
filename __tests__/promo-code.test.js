const mockUser = { getIdToken: jest.fn(async () => 'ID_TOKEN') };
const mockAuth = { currentUser: mockUser };

jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({ options: { projectId: 'stealanegg-5ac52' } }) }));
jest.mock('@react-native-firebase/auth', () => ({ getAuth: () => mockAuth, getIdToken: (u) => u.getIdToken() }));
jest.mock('@react-native-firebase/database', () => ({
  getDatabase: () => ({}),
  ref: (_db, path) => path,
  get: jest.fn(),
}));
jest.mock('react-native-device-info', () => ({ getUniqueId: jest.fn(async () => 'android-id') }));

const { get } = require('@react-native-firebase/database');
const { redeemPromoCode, fetchPromoProUntil } = require('../Code/Helper/promoCode');

const respond = body => { global.fetch = jest.fn(async () => ({ json: async () => body })); };

beforeEach(() => { mockAuth.currentUser = mockUser; });

test('posts the callable envelope with the ID token', async () => {
  respond({ result: { until: 123, days: 7 } });
  await expect(redeemPromoCode('FISCH7')).resolves.toEqual({ until: 123, days: 7 });
  const [url, init] = global.fetch.mock.calls[0];
  expect(url).toBe('https://us-central1-stealanegg-5ac52.cloudfunctions.net/redeemPromoCode');
  expect(init.headers.Authorization).toBe('Bearer ID_TOKEN');
  expect(JSON.parse(init.body)).toEqual({ data: { code: 'FISCH7', deviceId: 'android-id' } });
});

test('maps a server reason', async () => {
  respond({ error: { status: 'ALREADY_EXISTS', message: 'already_redeemed', details: { reason: 'already_redeemed' } } });
  await expect(redeemPromoCode('FISCH7')).rejects.toMatchObject({ reason: 'already_redeemed' });
});

test('unknown errors and network failures read as network', async () => {
  respond({ error: { status: 'INTERNAL', message: 'INTERNAL' } });
  await expect(redeemPromoCode('X')).rejects.toMatchObject({ reason: 'network' });
  global.fetch = jest.fn(async () => { throw new TypeError('Network request failed'); });
  await expect(redeemPromoCode('X')).rejects.toMatchObject({ reason: 'network' });
});

test('signed out never calls the server', async () => {
  mockAuth.currentUser = null;
  global.fetch = jest.fn();
  await expect(redeemPromoCode('X')).rejects.toMatchObject({ reason: 'sign_in' });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('fetchPromoProUntil: value, none, offline', async () => {
  get.mockResolvedValueOnce({ val: () => 999 });
  await expect(fetchPromoProUntil('u1')).resolves.toBe(999);
  get.mockResolvedValueOnce({ val: () => null });
  await expect(fetchPromoProUntil('u1')).resolves.toBe(0);
  get.mockRejectedValueOnce(new Error('permission'));
  await expect(fetchPromoProUntil('u1')).resolves.toBeNull();
});
