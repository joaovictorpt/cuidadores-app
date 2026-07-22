/**
 * Generic implementation of the Gale-Shapley algorithm, hospital-residents
 * variant: many-to-one stable matching where each receiver (hospital/
 * caregiver) can hold more than one proposer (resident/family) up to a
 * fixed capacity, while each proposer is matched to at most one receiver.
 *
 * This is deliberately generic (string ids + preference lists) instead of
 * being tied to Family/Caregiver types, so it can be unit-tested in
 * isolation from Prisma and the rest of the domain model.
 *
 * Result is PROPOSER-OPTIMAL: every proposer ends up with the best receiver
 * they could possibly get in ANY stable matching, at the cost of receivers
 * getting the worst outcome they could get in any stable matching. This is
 * the classical guarantee of the proposing side in Gale-Shapley.
 */

export type StableMatchingInput = {
  /** Ids of the proposing side (families). */
  proposers: string[];
  /** Ids of the receiving side (caregivers). */
  receivers: string[];
  /** proposerId -> receiverIds, ordered from most to least preferred. */
  proposerPreferences: Map<string, string[]>;
  /** receiverId -> proposerIds, ordered from most to least preferred. */
  receiverPreferences: Map<string, string[]>;
  /** Max number of proposers a single receiver can hold at once. */
  receiverCapacity: number;
};

export function stableMatching({
  proposers,
  receivers,
  proposerPreferences,
  receiverPreferences,
  receiverCapacity,
}: StableMatchingInput): Map<string, string[]> {
  // Final result: receiverId -> proposerIds currently held. Every receiver
  // starts empty, even ones nobody ever proposes to, so the returned Map
  // always has one entry per receiver.
  const matches = new Map<string, string[]>();
  receivers.forEach((receiverId) => matches.set(receiverId, []));

  // Each proposer walks their own preference list left to right, one step
  // at a time, never revisiting a receiver they already tried. This index
  // is what guarantees the algorithm terminates: it only ever increases.
  const nextProposalIndex = new Map<string, number>();
  proposers.forEach((proposerId) => nextProposalIndex.set(proposerId, 0));

  // Queue of proposers who still need to make a proposal this round --
  // either because they were never matched yet, or because they were just
  // rejected/bumped and need to try their next choice.
  const freeProposers: string[] = [...proposers];

  // Precompute, for every receiver, a proposerId -> rank lookup table from
  // their preference list (rank 0 = most preferred). This turns "does this
  // receiver prefer proposer A over proposer B" into an O(1) comparison
  // instead of two indexOf() scans per comparison.
  const receiverRank = new Map<string, Map<string, number>>();
  for (const receiverId of receivers) {
    const prefs = receiverPreferences.get(receiverId) ?? [];
    const rankMap = new Map<string, number>();
    prefs.forEach((proposerId, index) => rankMap.set(proposerId, index));
    receiverRank.set(receiverId, rankMap);
  }

  while (freeProposers.length > 0) {
    const proposerId = freeProposers.shift()!;
    const proposerPrefs = proposerPreferences.get(proposerId) ?? [];
    const proposeIndex = nextProposalIndex.get(proposerId)!;

    // This proposer has already proposed to everyone on their list and
    // been turned down by all of them -- they stay unmatched. This is a
    // normal, valid outcome of Gale-Shapley (e.g. no eligible caregiver
    // had room or interest), not an error.
    if (proposeIndex >= proposerPrefs.length) {
      continue;
    }

    const receiverId = proposerPrefs[proposeIndex];
    // Whatever happens next (accepted, bumped later, or rejected), this
    // proposer has now "used up" this choice -- next time they're free
    // they move on to the next entry in their list.
    nextProposalIndex.set(proposerId, proposeIndex + 1);

    const rankMap = receiverRank.get(receiverId);

    // The receiver never ranked this proposer at all, meaning this
    // proposer is unacceptable to them (e.g. outside eligibility criteria
    // from the receiver's own preference-building step). Per the standard
    // Gale-Shapley convention, an unranked proposer is auto-rejected --
    // skip straight back into the queue to try the next choice.
    if (!rankMap || !rankMap.has(proposerId)) {
      freeProposers.push(proposerId);
      continue;
    }

    const held = matches.get(receiverId)!;

    if (held.length < receiverCapacity) {
      // Receiver still has an open slot: accept provisionally. This is
      // only ever provisional -- a better-ranked proposer arriving later
      // can still bump this one out once the receiver is full.
      held.push(proposerId);
      continue;
    }

    // Receiver is already at capacity. Find the currently-held proposer
    // this receiver likes LEAST (highest rank number = least preferred),
    // since that's the only one worth comparing the new proposal against.
    let worstHeldIndex = 0;
    let worstHeldRank = -1;
    held.forEach((heldProposerId, index) => {
      const rank = rankMap.get(heldProposerId) ?? Number.POSITIVE_INFINITY;
      if (rank > worstHeldRank) {
        worstHeldRank = rank;
        worstHeldIndex = index;
      }
    });

    const newProposerRank = rankMap.get(proposerId)!;

    if (newProposerRank < worstHeldRank) {
      // Receiver prefers the new proposer over its current worst match:
      // swap them. The bumped proposer becomes free again and will try
      // their next preference on a future iteration -- they are NOT
      // discarded, just displaced, which is exactly what keeps the
      // algorithm converging toward stability instead of settling for a
      // suboptimal assignment.
      const bumpedProposerId = held[worstHeldIndex];
      held[worstHeldIndex] = proposerId;
      freeProposers.push(bumpedProposerId);
    } else {
      // Receiver already holds proposers it likes at least as much as
      // this one and has no room left: reject this proposal outright.
      // The proposer goes back into the queue to try their next choice.
      freeProposers.push(proposerId);
    }
  }

  return matches;
}
