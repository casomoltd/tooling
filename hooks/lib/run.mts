// The one shared helper behind every guard: registry evaluation plus a thin
// dispatcher. The dispatcher reads the hook payload with the stdlib
// (readFileSync on fd 0 — stdin is a finite pipe the harness closes after
// writing) and emits Claude Code's PreToolUse decision shape.
//
// Failure philosophy — a hook is advisory for commands it understands:
//   * matched a rule           -> emit its verdict (deny / ask).
//   * matched nothing          -> allow silently (the 99% path; don't nag).
//   * can't read the input at all (unparseable / no tool_input) -> ASK, so the
//     human decides rather than the guard proceeding blind. Not hard-`deny`:
//     these wrap every Bash/Edit call, so a guard hiccup must never brick the
//     workspace (you stay able to run the commands that fix or disable it).
import {readFileSync} from "node:fs";
import {preToolUseDecision, type PreToolUseHookInput} from "./contract.mts";
import {VERDICTS, type Rule, type ToolInput, type Verdict} from "./rule.mts";

// A guard runs only as the entry point, which a plugin may reach through a
// symlink; the check is the bin scripts' own.
export {isEntryPoint} from "../../bin/utils.mjs";

/** Each verdict's severity: a higher one outranks a lower. */
const SEVERITY: Readonly<Record<Verdict, number>> = {
  [VERDICTS.Ask]: 1,
  [VERDICTS.Deny]: 2,
};

const log = (message: string): void => {
  process.stderr.write(`[casomoltd hooks] ${message}\n`);
};

// Can't read the input -> ask the human rather than proceed blind. stderr too,
// so the reason is visible in logs as well as the confirmation dialog.
const ask = (reason: string): void => {
  log(reason);
  process.stdout.write(JSON.stringify(preToolUseDecision(VERDICTS.Ask, reason)));
};

// Return the highest-severity rule that matches, or null. On a severity tie the
// earliest rule wins (strict `>`), so registry order is the tie-break. A rule
// whose `matches` throws counts as a non-match, logged so the broken rule is
// seen — one broken predicate never blocks a tool.
export function evaluate(rules: readonly Rule[], input: ToolInput): Rule | null {
  let best: Rule | null = null;
  for (const rule of rules) {
    let hit = false;
    try {
      hit = rule.matches(input);
    } catch (err) {
      log(`${rule.id}: its match failed (${err instanceof Error ? err.message : err})`);
      hit = false;
    }
    if (!hit) continue;
    const outranks = !best
      || SEVERITY[rule.verdict] > SEVERITY[best.verdict];
    if (outranks) best = rule;
  }
  return best;
}

/** The matched rule's reason, with its detail after it where it has one. A
 *  detail that throws is left out, so the verdict never depends on it. */
export function reasonFor(rule: Rule, input: ToolInput): string {
  if (!rule.detail) return rule.reason;
  try {
    return `${rule.reason}\n\n${rule.detail(input)}`;
  } catch (err) {
    log(`${rule.id}: its detail failed (${err instanceof Error ? err.message : err})`);
    return rule.reason;
  }
}

// Read the payload, evaluate the registry, emit the verdict. We only `ask` when
// the input is genuinely unreadable (unparseable, or no tool_input) — we don't
// hunt for missing fields; a present-but-odd payload that matches no rule is
// just allowed.
export function runGuard(rules: readonly Rule[]): void {
  let input: ToolInput | undefined;
  try {
    const payload = JSON.parse(readFileSync(0, "utf8")) as PreToolUseHookInput;
    input = payload.tool_input as ToolInput | undefined;
  } catch {
    return ask("could not read the hook input — confirm this action manually");
  }
  if (!input || typeof input !== "object") {
    return ask("hook payload had no tool_input — confirm this action manually");
  }

  const matched = evaluate(rules, input);
  if (!matched) return; // matched nothing -> allow silently
  const reason = reasonFor(matched, input);
  process.stdout.write(JSON.stringify(preToolUseDecision(matched.verdict, reason)));
}
