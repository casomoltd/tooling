module.exports = {
  rules: {
    'header-max-length': [2, 'always', 50],
    'body-max-line-length': [2, 'always', 72],
    'no-ai-attribution': [2, 'always'],
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
          // otherwise cannot write a commit saying which file it changed. That
          // is not hypothetical: it cost a real commit two rejections before
          // the message was reworded to talk around its own filename.
          //
          // Stripped rather than allow-listed, so the scan still sees whatever
          // surrounds them: `Co-Authored-By: Claude` in a message that also
          // edits `.claude/settings.json` is still caught.
          const scanned = fullMessage
            .replace(/[\w./~-]*claude\.md/g, '')
            .replace(/[~.]?\/?\.claude\/[\w./-]*/g, '');
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
