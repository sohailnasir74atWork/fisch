// Saved snapshots use the poster's perspective; adapt only the displayed view.
export function tradePerspective(trade, snapshot, viewerId) {
  const own = Boolean(viewerId && trade.userId === viewerId);
  const evaluation = snapshot?.evaluation;
  return {
    own,
    giveItems: (own ? trade.hasItems : trade.wantsItems) || [],
    receiveItems: (own ? trade.wantsItems : trade.hasItems) || [],
    giveTotal: (own ? snapshot?.has : snapshot?.wants)?.total ?? null,
    receiveTotal: (own ? snapshot?.wants : snapshot?.has)?.total ?? null,
    evaluation: !evaluation || own ? evaluation : {
      ...evaluation,
      verdict: evaluation.status === 'complete'
        ? ({ win: 'lose', lose: 'win', fair: 'fair' }[evaluation.verdict] ?? null)
        : null,
    },
  };
}
