// The internal rule model — the contract between a guard (which declares rules)
// and the engine (which evaluates them). Distinct from contract.mts, which is
// the EXTERNAL harness wire contract; this is our own vocabulary.

/** What a rule's predicate inspects: the harness types `tool_input` as
 * `unknown` (it varies per tool), so guards read fields off a loose bag and
 * coerce defensively. */
export type ToolInput = Record<string, unknown>;

/** What a matched rule does, in rising severity: ask the person, or refuse. */
export const VERDICTS = {Ask: "ask", Deny: "deny"} as const;

export type Verdict = (typeof VERDICTS)[keyof typeof VERDICTS];

/** A single guard rule. `matches` must be pure — a throw is logged and
 * treated as a non-match. */
export interface Rule {
  id: string;
  verdict: Verdict;
  reason: string;
  matches: (input: ToolInput) => boolean;
  /** What the prompt adds after the reason, read when the rule matches, or
   *  undefined where it has nothing to add. It may read the disk; a throw
   *  drops it and the reason stands alone. */
  detail?: (input: ToolInput) => string | undefined;
}
