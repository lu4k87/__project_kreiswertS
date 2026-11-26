// Status flows of the platform: which statuses exist and which changes are allowed.
// Pure data + functions without a database → testable on their own (status.test.ts).
// New flow (e.g. container tracking, docs/FEATURES.md) = new table in the same format.

/** Erlaubte Wechsel je Status; leere Liste = Endstatus */
export type Flow<S extends string> = Readonly<Record<S, readonly S[]>>;

export const COOPERATION_STATUSES = [
  "requested",
  "negotiation",
  "agreed",
  "in_progress",
  "completed",
  "rejected",
  "cancelled",
] as const;

/** Status einer Kooperation (Spalte agreements.status) */
export type CooperationStatus = (typeof COOPERATION_STATUSES)[number];

/** Requested → Negotiation → Agreed → In Progress → Completed; rejected/cancelled any time before completion */
export const cooperationFlow: Flow<CooperationStatus> = {
  requested: ["negotiation", "agreed", "rejected", "cancelled"],
  negotiation: ["agreed", "rejected", "cancelled"],
  agreed: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function canTransition<S extends string>(flow: Flow<S>, from: S, to: S): boolean {
  return flow[from].includes(to);
}

export function isFinal<S extends string>(flow: Flow<S>, status: S): boolean {
  return flow[status].length === 0;
}
