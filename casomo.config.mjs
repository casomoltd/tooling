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
};

export default config;
