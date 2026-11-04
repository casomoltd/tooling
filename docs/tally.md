# Tally

Keep a site's [Tally](https://tally.so) forms as code: write each form as a
`FormDefinition`, and the `tally` command pushes it, reads it back and compares
it with what Tally holds. A site keeps only its forms, their ids and their
styling; the translator, the API client, the comparison and the command are
here. Where Tally behaves differently from its API reference is
[Undocumented behaviour](#undocumented-behaviour).

## Form model and styling

`@casomoltd/tooling/tally` exports the form model and the translator; the
model's every field is documented in its [types](../tally/index.d.mts).

- **`toBlocks` and `toSettings`** turn a `FormDefinition` into what a push
  sends, and **`blockNames`** names each block for a diff to print. A form names
  its `locale` (currency and date format) because a default would pick one
  country's without saying so.
- **`FormIndex`** gives the uuid of a question's title, input, options or stop
  message, for a site's custom CSS to target with **`blockSelectors`**. Each
  lookup throws when the form has no such question, so the CSS can't name a
  block that isn't there.
- **`@casomoltd/tooling/tally/paths`** exports `Paths` and `stableUuid`
  ([Key stability](#key-stability)) alone,
  for code that reads a submission by block (a webhook) without loading the
  builder.
- **`@casomoltd/tooling/tally/events`** is for a page that embeds a form
  ([types](../tally/events.d.mts)). `tallyEmbedSrc`, `tallyFormHref`,
  `TALLY_WIDGET_URL` and `TALLY_EMBED_OPTIONS` give the addresses it loads,
  and `readTallyEvent`, `TALLY_EVENTS` and `TALLY_ORIGIN` read what the embed
  posts back: it takes a message event whole, checks it came from
  Tally, and reads it down to a page view's number or the fact of a
  submission, never the answers a submission carries. It imports nothing, so
  it is safe in a browser bundle, which the rest of `./tally` is not.

## A site's settings

Under `tally` in the repo's `casomo.config.mjs`. Every path is resolved against
the repo:

```js
export default {
  tally: {
    // A module exporting `forms`, an array of FormDefinition.
    forms: 'tally/forms.ts',
    // Each form's Tally id, by form key: written on first push.
    registry: 'tally/forms.json',
    // The record of each form's last push. Keep it out of git.
    pushed: 'tally/pushed',
    // The site stylesheet the design tokens are declared in.
    globals: 'src/app/globals.css',
    // The form stylesheet holding a generated TOKENS block.
    stylesheet: 'tally/styles.css',
    // Variable the form stylesheet reads, then the site token it copies.
    tokens: [['--form-ink', '--color-brand-text-dark']],
    // Optional: the environment variable holding the API key.
    apiKeyEnv: 'TALLY_API_KEY',
  },
};
```

The forms module may be TypeScript: it runs from the site's own tree, where
Node strips the types, unlike a file under `node_modules`.

## The command

```bash
tally push <form> [--discard-edits] [--delete-answers]
                              # push, read back, report any difference
tally diff <form>             # editor edits not yet in the code, and code
                              # changes not yet pushed
tally tokens [--check]        # rewrite the TOKENS block, or fail if stale
```

A form with no id in the registry is created as a draft and its id written
back; publish it in Tally's editor. A form with one is replaced in place.
**A push replaces the whole form**: Tally's `PATCH` takes the complete
`blocks` array and deletes any block left out. Two guards stop a push losing
work, each with its own flag so getting past one never switches off the
other:

- **It refuses to delete answers the live form holds**: a question, an
  option, a hidden field or a calculation, which Tally deletes the answers
  with. `--delete-answers` overrides it; use it only for a form not yet taking
  answers, after checking its submissions.
- **It refuses to delete edits made in Tally's editor** since the last push;
  [Editing in Tally](#editing-in-tally) brings them into the code.
  `--discard-edits` overrides it. With no record of the last push (it is a
  cache the site keeps out of git), every difference from the live form
  counts, so read `tally diff` first.

## Editing in Tally

Wording can be edited in Tally's editor and brought into the code:

1. **Reload the editor first.** A tab opened before the last push still holds
   the older form, and saving or publishing from it puts that version back.
   Then edit, and **Publish**: unpublished editor changes are invisible to the
   API.
2. `tally diff <form>` lists what was edited in Tally since the last push, and
   separately what the code has changed and not yet pushed. It tells the two
   apart by comparing each with the last push.
3. Make the same edits in the form's code until `tally diff` reports no editor
   edits, then push.

A long list of edits that undo recent code changes is a stale editor tab
publishing its old copy, not new work.

## Key stability

Every block's uuid is derived from the form key and a path within it
(`stableUuid`). Tally ties answers, Sheet columns and logic to those uuids, so
a re-push keeps them. **Renaming a question key, or the form key, makes a new
question**: its old answers stay under the old column and the new one starts
empty. Change a title freely; change a key only before the form is live. A
question's title is its Sheet column name, so the translator refuses two
questions under one title.

## Undocumented behaviour

These aren't in Tally's API reference. Each was observed by pushing a form and
reading it back.

- **Option references must be shaped as version 4 uuids.** Otherwise a choice
  condition fails with "value type is not allowed for this comparison".
- **Text is stored as `safeHTMLSchema`.** Tally accepts the documented `html`,
  converts it, and returns only `safeHTMLSchema`, so the translator sends that
  and a read-back compares like with like.
- **`HIDE_BUTTON_TO_DISABLE_COMPLETION` takes no payload**, not even an empty
  one.
- **A logic rule must name every group it shows**: the title, help and input
  groups, or the title stays on screen. A hidden note is the exception: the
  rule must name the note's block as well as its group, or Tally hides the
  button and never shows the message.
- **An email question takes `requireVerification: true`**, which needs a paid
  Tally plan. The respondent presses Verify, is sent a 6-digit code, and can't go
  on until they enter it.
- **Tally's own out-of-range message has fixed wording.** A number question's
  `rangeMessage` drops Tally's limits and puts a stop message in their place,
  shown when the answer is `LESS_THAN` the minimum or `GREATER_THAN` the
  maximum.
- **A date question takes `dateRange: {from, to}`**, ISO dates. The picker
  offers only dates in it, and a typed date outside it gets Tally's own message
  and keeps the respondent on the page. `disableDays: ["IN_THE_FUTURE"]` rules
  out the future.
- **A checkbox or dropdown condition takes `IS_ANY_OF`.** Tally refuses `IS`
  on either, even for one option.
- **`styles` is an object, not the string the reference says:**
  `{theme, color: {background, text, accent, buttonBackground, buttonText},
  font, css}`. A push's settings are merged into the form's, so a setting it
  does not send is left as it is.
- **Hidden fields are filled from the form's address, by name**, on both
  `/r/<id>` and `/embed/<id>`: `?source=newsletter` is stored as
  `{"source": "newsletter"}`. They are one `HIDDEN_FIELDS` block whose payload
  is `{hiddenFields: [{uuid, name}]}`.
- **A condition or calculation reads a hidden field** as a field of type
  `HIDDEN_FIELD`, question type `HIDDEN_FIELDS`, whose block group is the
  hidden-fields block's group. `IS_EMPTY` on it is true when the address
  carried no value.
- **A setting's text mentions an answer as a marked run**:
  `["@<title>", [["tag", "span"], ["mention", <uuid>]]]`, with the setting's
  `mentions` holding `{uuid, field, defaultValue}`, whose `field` is the
  answer's reference as a condition reads it. Tally adds the `span` tag itself,
  so the translator sends it to compare like with like.
- **`respondentEmailAttachPdf` attaches the respondent's answers as a PDF** to
  the confirmation email. It is a form setting, sent with the others; the API
  reference doesn't list it.
- **Deleting a submission leaves its Sheet row.** The two are deleted
  separately.
- **Publishing adds a trailing slash to a bare-domain link.** Write such a
  link with the slash, or the code differs from the live form.
