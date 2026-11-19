// Status-Abläufe der Plattform: welche Status es gibt und welche Wechsel erlaubt sind.
// Reine Daten + Funktionen ohne Datenbank → einzeln testbar (status.test.ts).
// Neuer Ablauf (z. B. Container-Tracking, docs/FUNKTIONEN.md) = neue Tabelle im selben Format.

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

/** Requested → Negotiation → Agreed → In Progress → Completed; abgelehnt/abgebrochen jederzeit vor dem Abschluss */
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
