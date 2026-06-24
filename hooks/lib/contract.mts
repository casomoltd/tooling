// Claude Code PreToolUse command-hook contract — the wire shapes the harness
// exchanges with a command hook over stdin/stdout.
//
// These types are vendored (transcribed) from the Claude Agent SDK,
// `@anthropic-ai/claude-agent-sdk@0.3.187` (`sdk.d.ts`), which is the source of
// truth for the contract; see also the prose docs at
// https://code.claude.com/docs/en/hooks. Vendored rather than imported to keep
// this public config repo dependency-free (no ~3.6MB SDK pulled in just for
// types, and no `skipLibCheck`). Re-sync from `sdk.d.ts` if the SDK bumps them.
//
// Stdout is a `SyncHookJSONOutput`; for PreToolUse the meaningful part is
// `hookSpecificOutput: PreToolUseHookSpecificOutput`.

/** A PreToolUse permission decision (SDK: `HookPermissionDecision`). */
export type HookPermissionDecision = "allow" | "deny" | "ask" | "defer";

/** Stdout block for PreToolUse (SDK: `PreToolUseHookSpecificOutput`). */
export interface PreToolUseHookSpecificOutput {
  hookEventName: "PreToolUse";
  permissionDecision?: HookPermissionDecision;
  permissionDecisionReason?: string;
  updatedInput?: Record<string, unknown>;
  additionalContext?: string;
}

/** The decision object a command hook prints to stdout (subset of the SDK's
 * `SyncHookJSONOutput`, whose `hookSpecificOutput` is optional). */
export interface PreToolUseHookOutput {
  hookSpecificOutput: PreToolUseHookSpecificOutput;
}

/** Stdin payload for PreToolUse (SDK: `PreToolUseHookInput`, a subset here —
 * the full type also carries agent_id/agent_type, etc.). `tool_input` is
 * `unknown` upstream because its shape varies per tool. */
export interface PreToolUseHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
}

/** Build a PreToolUse decision in the documented shape. */
export function preToolUseDecision(
  permissionDecision: HookPermissionDecision,
  reason: string,
): PreToolUseHookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision,
      permissionDecisionReason: reason,
    },
  };
}
