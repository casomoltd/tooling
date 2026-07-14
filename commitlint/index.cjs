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
          const forbidden = ['anthropic', 'claude', 'co-authored-by'];
          const found = forbidden.filter((term) => fullMessage.includes(term));
          return [
            found.length === 0,
            `Commit must not mention AI tools: found "${found.join(', ')}"`,
          ];
        },
      },
    },
  ],
};
