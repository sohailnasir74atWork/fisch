/**
 * journalUtils.js — writer for the trade journal.
 *
 * Written by the calculator's "Log Trade" sheet (TradeCompletion.js) and read
 * by My Stuff → History, which is the single journal surface in the app.
 *
 * Storage: Firestore trade_journal/{uid}/trades/{autoId}.
 */
import {
  collection, doc, setDoc, deleteDoc, serverTimestamp,
  query, orderBy, limit, getDocs, writeBatch,
} from '@react-native-firebase/firestore';
import { serializeTradeItem, createTradeSnapshot, catchDescription } from '../Helper/valueSources';

export const JOURNAL_RESULTS = ['win', 'fair', 'loss'];

// Bumped on every write. Readers (My Stuff → History) keep the revision they
// last fetched at and only re-query when it moves — so navigating back and
// forth costs zero Firestore reads unless a trade was actually logged.
let journalRevision = 0;
export const getJournalRevision = () => journalRevision;

/** Normalize a calculator/inventory item to the slim shape stored on an entry. */
export const slimItem = (item, scale = 'value') => serializeTradeItem(item, scale);

/** Comma-joined item names, with xN for duplicates: "Chroma Lightbringer x2, Candy" */
export const summarizeItems = (items) => {
  const counts = new Map();
  (Array.isArray(items) ? items : []).forEach((it) => {
    const name = [it?.name || it?.Name || it?.title, catchDescription(it)].filter(Boolean).join(' · ');
    if (!name) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, n]) => (n > 1 ? `${name} x${n}` : name))
    .join(', ');
};

/**
 * Append a completed trade to the user's journal.
 *
 * @param {object} firestoreDB
 * @param {string} uid
 * @param {object} entry
 * @param {Array}  entry.givenItems     items the user gave away
 * @param {Array}  entry.receivedItems  items the user got
 * @param {number} entry.givenValue
 * @param {number} entry.receivedValue
 * @param {string} [entry.result]       'win' | 'fair' | 'loss' — derived when omitted
 * @param {string} [entry.note]
 * @returns {Promise<string>} the new document id
 */
export const addJournalEntry = async (firestoreDB, uid, entry = {}) => {
  if (!firestoreDB || !uid) throw new Error('You need to be signed in to log a trade.');

  const scale = entry.valueSource || 'value';
  const givenItems = (entry.givenItems || []).filter(Boolean);
  const receivedItems = (entry.receivedItems || []).filter(Boolean);
  const valuation = createTradeSnapshot(givenItems, receivedItems, scale);
  const givenValue = valuation.has.total, receivedValue = valuation.wants.total;
  const verdict = valuation.evaluation.verdict;
  const result = verdict === 'lose' ? 'loss' : verdict || 'not_evaluated';
  const rawRating = entry.result === 'lose' ? 'loss' : entry.result;
  const userRating = JOURNAL_RESULTS.includes(rawRating) ? rawRating : null;
  const gave = givenItems.map(item => slimItem(item, scale));
  const got = receivedItems.map(item => slimItem(item, scale));

  const ref = doc(collection(firestoreDB, 'trade_journal', uid, 'trades'));
  await setDoc(ref, {
    result,
    userRating,
    valuation,
    valueSource: valuation.scale,
    unit: valuation.unit,
    // Joined-name strings — what the My Stuff → History rows render
    given: summarizeItems(entry.givenItems),
    givenValue,
    received: summarizeItems(entry.receivedItems),
    receivedValue,
    // Full item arrays, so a richer timeline (thumbnails, per-item values) can
    // be built later without a migration
    gave,
    got,
    note: (entry.note || '').trim(),
    partnerName: (entry.partnerName || '').trim(),
    didScam: !!entry.didScam,
    createdAt: serverTimestamp(),
  });
  journalRevision++;
  return ref.id;
};

/** Delete a single logged trade. */
export const deleteJournalEntry = async (firestoreDB, uid, entryId) => {
  if (!firestoreDB || !uid || !entryId) return;
  await deleteDoc(doc(firestoreDB, 'trade_journal', uid, 'trades', entryId));
  journalRevision++;
};

/**
 * Wipe the whole trade history.
 *
 * Firestore has no client-side "delete collection", so this pages through the
 * subcollection deleting in batches. Batches cap at 500 ops, and the page size
 * matches so each round is exactly one query + one commit.
 *
 * @returns {Promise<number>} how many entries were deleted
 */
export const clearJournal = async (firestoreDB, uid) => {
  if (!firestoreDB || !uid) return 0;
  const base = collection(firestoreDB, 'trade_journal', uid, 'trades');
  let deleted = 0;

  // Bounded so a pathological/looping case can't spin forever.
  for (let round = 0; round < 40; round++) {
    const snap = await getDocs(query(base, orderBy('createdAt', 'desc'), limit(500)));
    if (snap.empty) break;
    const batch = writeBatch(firestoreDB);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.docs.length;
    if (snap.docs.length < 500) break;
  }

  journalRevision++;
  return deleted;
};
