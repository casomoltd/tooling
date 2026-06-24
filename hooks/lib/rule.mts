// The internal rule model — the contract between a guard (which declares rules)
// and the engine (which evaluates them). Distinct from contract.mts, which is
// the EXTERNAL harness wire contract; this is our own vocabulary.

/** What a rule's predicate inspects: the harness types `tool_input` as
 * `unknown` (it varies per tool), so guards read fields off a loose bag and
 * coerce defensively. */
export type ToolInput = Record<string, unknown>;

export type Verdict = "deny" | "ask" | "warn";

/** A single guard rule. `matches` must be pure — a throw is treated as a
 * non-match. */
export interface Rule {
  id: string;
  verdict: Verdict;
  reason: string;
  matches: (input: ToolInput) => boolean;
}
