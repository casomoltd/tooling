// Every gate this repo configures, one key each: `personalData` for
// check-personal-data, `privateRefs` for check-private-refs.
const config = {
  personalData: {
    allowEmail: [
      // The trailer the commit-message gate refuses, named so it can refuse it.
      /^noreply@anthropic\.com$/i,
      // The company's published contact address.
      /@casomoltd\.com$/i,
    ],
    // The rules' own tests hold invented values in every shape they catch.
    allow: [/^bin\/check-personal-data\.test\.mjs$/],
  },
  privateRefs: {
    // Stated rather than asked of `gh`, which has no login in CI: there the
    // lookup fails and the check would skip, on the publish run above all.
    visibility: 'public',
  },
};

export default config;
