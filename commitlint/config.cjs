/** The house commit-message rules, and the plugin that refuses AI attribution. */
/** commitlint's severity for a rule that fails the commit. */
const ERROR = 2;

/** The house limits: a scannable subject, and a body that wraps in a terminal. */
const HEADER_MAX = 50;
const BODY_LINE_MAX = 72;

/** True for a word that is a path in this toolchain, not attribution. */
const isToolchainPath = (word) =>
  word.endsWith('claude.md') || word.includes('.claude/');

module.exports = {
  rules: {
    'header-max-length': [ERROR, 'always', HEADER_MAX],
    'body-max-line-length': [ERROR, 'always', BODY_LINE_MAX],
    'no-ai-attribution': [ERROR, 'always'],
  },
  plugins: [
    {
      rules: {
        'no-ai-attribution': ({ header, body, footer }) => {
          // `footer` matters: the parser files trailers like
          // `Co-Authored-By: …` there, not under `body`, so a header+body
          // check misses exactly the line this rule exists to catch. (Not
          // `raw`: under `git commit -v` that can carry the whole diff.)
          const fullMessage = `${header}\n${body || ''}\n${footer || ''}`.toLowerCase();
          // `CLAUDE.md` and `.claude/…` are paths in this toolchain, not
          // attribution, and a repo whose instruction file is called CLAUDE.md
          // otherwise cannot write a commit saying which file it changed.
          //
          // Each such word is stripped rather than allow-listed, so the scan
          // still sees whatever surrounds it: `Co-Authored-By: Claude` in a
          // message that also edits `.claude/settings.json` is still caught.
          const scanned = fullMessage
            .split(/\s+/)
            .filter((word) => !isToolchainPath(word))
            .join(' ');
          const forbidden = ['anthropic', 'claude', 'co-authored-by'];
          const found = forbidden.filter((term) => scanned.includes(term));
          return [
            found.length === 0,
            `Commit must not mention AI tools: found "${found.join(', ')}"`,
          ];
        },
      },
    },
  ],
};
