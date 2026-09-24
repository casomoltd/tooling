// Addresses and paths in this repo that are not a person's details.
export default {
  allowEmail: [
    // The trailer the commit-message gate refuses, named so it can refuse it.
    /^noreply@anthropic\.com$/i,
    // The company's published contact address.
    /@casomoltd\.com$/i,
  ],
  // The rules' own tests hold invented values in every shape they catch.
  allow: [/^bin\/check-personal-data\.test\.mjs$/],
};
