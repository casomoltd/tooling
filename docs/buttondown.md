# Buttondown newsletters as code

The `buttondown` command keeps a Buttondown newsletter's settings, skins and email
templates as files in a repo, applies them to the live newsletter, and gates them
in the repo's `check`. How the platform itself behaves is in
[Buttondown: how the platform behaves](buttondown-platform.md).

## A repo's layout

```text
casomo.config.mjs        buttondown: the newsletter, tokens and gates
buttondown/
  newsletter.json        the newsletter's short fields
  tags.json              its tags, keyed by id (optional)
  fields/                one file per long field, named after it
  skins/                 the site's own rules for composed skins
  checks.mjs             the repo's own gates (optional)
```

Each file in `fields/` is the Buttondown field it is named after. A stylesheet or
text file is sent verbatim; an `.mjs` file's default export is the value, a string
or, for a structured field such as `socials`, an array or object. A module lets a
field be built from the site's own constants, so the newsletter and the site can't
drift apart. A field may be set in `newsletter.json` or in `fields/`, never both.

The newsletter's identity is never one of its fields: `newsletter.json` holding
`id`, `publicId` or `username` is refused.

## Configuration

Under `buttondown` in the repo's `casomo.config.mjs`:

| Key | What it is |
|---|---|
| `newsletter` | `{id, username}`, and `publicId` where an endpoint returns the prefixed form: the one newsletter the repo may write to. Required. |
| `globals` | The stylesheet the site's design tokens are declared in. Required. |
| `dir` | Where `newsletter.json` and `fields/` are; `buttondown` by default. |
| `tokens` | `[target, source]` pairs: each line of the web skin's TOKENS block, the variable it sets and the site token it copies. |
| `extra` | `[target, value]` pairs after them, without a comment; a value starting `--` is read from the tokens, anything else is literal. |
| `asserts` | Tokens the skins depend on, with the value each must keep. |
| `webSkin` | The file holding the TOKENS block, when the web skin is composed; `<dir>/fields/web_css.css` by default. |
| `allowedHides` | Each selector the skins may hide, with its reason. |
| `linkClasses` | The classes the email skin keys an `a.<class>` rule on. |
| `ownLinks` | Href fragments the web skin keys on that aren't `socials` URLs, beside Buttondown's own. |
| `paletteFiles` | Other files (an icon, an SVG) whose colours must be the site's. |
| `checks` | Paths to the repo's own [gates](#what-check-refuses). |

A token is read from a top-level `:root` or `@theme` block of `globals`; a variant
such as `.dark` or a `:root` inside `@media` is not the token.

## Commands

Run through the repo's `buttondown` npm script, which sets the key file:

```sh
npm run buttondown                 # diff: what live differs in; exits 1 on drift
npm run buttondown -- apply        # patch the fields and tags that differ
npm run buttondown -- check        # gate the skins and settings; no key needed
npm run buttondown -- tokens       # rewrite the TOKENS block from the tokens
npm run buttondown -- emit <dir>   # write each long field out as rendered
npm run buttondown -- draft <f.md> # create or replace a draft
npm run buttondown -- upload <img> # upload an image, print its URL
npm run buttondown -- api <METHOD> <path> [json]
```

- **`apply`** patches only what differs, and exits 1 if Buttondown refused any
  field or tag, so a script can gate on it.
- **`draft`** takes a markdown file whose first line, after any front matter, is
  `# Subject`. The new draft's id is written back into the front matter, so a
  re-run replaces that draft; `slug` and `description` pass through. A draft
  already sent is refused rather than rewritten.
- **`api`** exists for setting a manual test up and tearing it down. It writes
  newsletter settings only to the configured newsletter, judged on the path the
  server routes.

## The key and the newsletter

The key is read from the file `BUTTONDOWN_KEY_FILE` names, never from the command
line, where it would sit in the shell history and in `ps`. It reaches every
newsletter on the account, so every request carries `Buttondown-Context` with the
configured id. `apply` also checks the newsletter it reads before writing, and the
one each write returns, against the configured id (or `publicId`) and username;
either mismatch stops the run. `api` refuses a write to another newsletter's
settings instead; reads, and writes outside `/newsletters`, are unrestricted.

## What `check` refuses

`check` reads the fields as they will be sent, composed skins included; a
newsletter with no `web_css` or `css` field is refused, since there would be
nothing to check. It fails when:

- the web skin's TOKENS block is stale against the tokens (when `tokens` or
  `extra` is set), or an `asserts` token has moved;
- a skin, or a `paletteFiles` file, uses a hex colour the `globals` stylesheet
  doesn't contain; only hex is checked, so an `rgb()` or named colour passes;
- a skin hides anything (`display: none`, `font-size: 0`) that `allowedHides`
  doesn't list;
- a skin injects text with `content:`;
- a web-skin `href` selector matches no `socials` URL or `ownLinks` entry;
- an email link class has no `a.<class>` rule;
- the web skin has an `@import` that isn't a whole statement before its first
  rule: one after a rule, which browsers ignore, or one whose URL was cut short;
- the web skin reads a variable nothing declares: a `--bd-*` role, or one the
  shared web rules read; the declaration reading it would be dropped;
- one of the repo's own gates reports a problem.

A gate is a module whose default export takes `{root, payload, css, web, email,
readToken}` and resolves to a list of problems, empty when clean; the `Check` type
in `@casomoltd/tooling/buttondown` declares it.

## Shared skins and email blocks

A site whose emails draw their own bands, and whose blog wears its own skin, takes
the shared parts from `@casomoltd/tooling/buttondown` and keeps only its own:

- **An email theme** is one value a site defines once and passes to both email
  functions: `{fonts: {body, heading}, colours: {page, ink, heading}, leading:
  {body, prose}}`. Either function names any missing part of it rather than
  rendering `undefined`.
- **`createEmailBlocks(options)`** returns the bands an email is built from: the
  title card, white air, paragraphs, body links, the one action, the sign-off and
  the small print. Beside the theme, the site supplies the rest of its look and
  its small print, every part required (`EmailBlockOptions` in
  `index.d.mts`), and draws its own mark band. `footer()` must be told whether
  there is a subscription to leave.
- **`emailBaseCss(theme)`** writes the rules every site's emails share, with
  literal values, since a mail client can't resolve a custom property: the page,
  prose (justified), headings, links, rules, square corners on everything, the
  container resets, and a hide for each piece
  of Buttondown's email chrome (`EMAIL_CHROME_HIDES`, which the site spreads into
  `allowedHides`). A site's `fields/css.mjs` appends its own stylesheet.
- **`composeWebSkin(site)`** inserts the shared web rules after the site
  stylesheet's leading comments and `@charset`, `@import` and `@layer`
  statements and ahead of its own rules, so the site's win a tie. The shared
  rules read their values from variables the site's TOKENS block declares:
  Buttondown's `--color-background`, `--color-foreground`, `--font-family-sans`
  and `--radius`, and these roles the theme lacks:

  | Variable | Role |
  |---|---|
  | `--bd-font-heading` | headings and an archive entry's title |
  | `--bd-heading` | their colour |
  | `--bd-action-bg`, `--bd-action-ink`, `--bd-action-weight` | the one action |
  | `--bd-dialog-bg` | a dialog's ground |
  | `--bd-focus` | the focus ring |
  | `--bd-leading` | an archive entry's line height |

  A site's `fields/web_css.mjs` composes its `skins/web.css`, and `webSkin` names
  that file so `tokens` rewrites its block.
