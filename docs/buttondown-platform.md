# Buttondown: how the platform behaves

What Buttondown does that its documentation doesn't make obvious, for newsletters
kept with the [`buttondown` command](buttondown.md). Each entry is a behaviour of
the platform, not of any one newsletter.

## The API

- **One key, every newsletter.** An account's API key reaches every newsletter on
  it. A request names its newsletter with the `Buttondown-Context` header; without
  it, the request goes to the account's default newsletter, and an unknown id is
  refused rather than falling back
  ([authentication](https://docs.buttondown.com/api-authentication)). The command
  sends the header on every call.
- **A newsletter has two ids.** Most endpoints return its UUID; some return a
  prefixed form (`news_…`) for the same newsletter.
- **A plan-gated field fails the whole PATCH**, naming a feature rather than the
  field, so one field the plan won't take blocks every other field in the call.
  `buttondown apply` retries field by field and reports the refused one.
- **Some fields are dashboard-only.** These exist on the newsletter object and can
  be read from the hosted page's embedded JSON, but a PATCH refuses them as
  `extra_forbidden`:

  | Field | What it controls |
  |---|---|
  | `subscription_form_text` | the line above the form |
  | `subscription_button_text` | the submit button's label |
  | `unsubscription_reasons` | the options in the unsubscribe dialog |
  | `honeypot_field_name` | the hidden bot-trap input on the form |

  Header navigation links are a paid add-on with no API field at all, and so is
  the subscription-reminder toggle (Settings → Subscribing). To read a
  dashboard-only value, fetch a hosted page with a browser `User-Agent` and take
  it from the newsletter JSON embedded in the page; a plain fetch gets a 403.
- **Images must be uploaded, not linked.** `icon` and `image` take a URL, but
  Buttondown serves them through its own proxy, which refuses some origins. Upload
  with `buttondown upload`: PNG, JPG, GIF and WebP only, so an SVG is rasterised
  first. The stored value is the proxy's URL, which `diff` decodes back to the
  upload's.
- **`socials` labels are at most 32 characters, and URLs must be http(s)**, so a
  `mailto:` is refused. `linkedin` and `github` entries render as Buttondown's own
  brand images; `generic` entries render their label.
- **There is no en-GB.** It covers date patterns and two error strings; every
  other string falls back to American English.

## Sign-up and tags

- **Tags come from the URL, and only from the URL.** The hosted form reads `tag`
  query parameters and has no tag controls. Tag-picking exists only in the
  subscriber portal, after sign-up, and only for tags marked
  `subscriber_editable`. A sign-up through the hosted form without a tag in its
  URL arrives untagged.
- **An unknown tag is created, not rejected.** Posting a tag name the account
  doesn't hold creates it, so a typo opens a second list nothing sends to. Key
  tags by id: a tag's name is the label a subscriber reads, so renaming one is an
  ordinary edit.
- **Two redirect fields, and only one is safe.** `subscription_redirect_url`
  fires when the form is submitted, before the address is confirmed: it throws
  the reader off the "check your email" state and makes a failed submission look
  like success. `subscription_confirmation_redirect_url` fires after the reader
  clicks the confirmation link, and hides nothing. It is one value per
  newsletter, whichever form or tag a reader signed up with, so the page it names
  should describe no one list.
- **The reminder template is the resend.** `POST
  /v1/subscribers/{id_or_email}/send-reminder` is the only resend the API offers,
  and it sends the reminder body, so that template is read by somebody who has
  just submitted the form twice. The same template is what the automatic 24-hour
  reminder sends if it's switched on. The API returns `200` for a `regular`
  subscriber too, so treat it as sending one: never call it for a confirmed
  subscriber.
- **Creating a subscriber as `unactivated` sends the real confirmation email**,
  which makes `buttondown api POST /subscribers` a complete stand-in for the form
  when testing what arrives.
- **The spam firewall (`auditing_mode`) scores `name+suffix@` addresses as
  suspicious** and refuses legitimate sign-ups, with no way to release one
  address: the settings are `disabled`, `enabled` and `aggressive`. It also judges
  a sign-up by the IP address it arrives from; a sign-up posted by a server is
  judged on the server's address unless the subscriber's `ip_address` is sent.
  Settings → Firewall has an exemption list.
- **The success state is a query string.** `/?state=confirmed_subscription` shows
  the dialog a reader sees after confirming, which is how to test its styling.

## Unsubscribing

- **`{{ unsubscribe_url }}` opens the preferences portal.** It unsubscribes nobody
  by itself; leaving is the portal's Unsubscribe button and its dialog. The
  one-click unsubscribe is the `List-Unsubscribe` header Buttondown adds to every
  send, which Gmail and Apple Mail draw as their own button.
- **Unsubscribing is reversible; a suppression isn't.**

  | State | Reversible | How |
  |---|---|---|
  | `unsubscribed` | yes | `PATCH {"type": "regular"}` |
  | deleted, any state | yes | `POST` the address again |
  | `subscriber_suppressed` | **no** | nothing works |

  A suppression leaves no subscriber record, so there is nothing to PATCH. Its
  error names two remedies and neither works; its wording, "previously
  unsubscribed or rejected", covers a spam complaint.
- **There is no custom unsubscribe URL.** No field on the newsletter object takes
  one.
- **The log-in (magic-link) email is Buttondown's**, sent from its own address in
  its own template. No field restyles it.

## The hosted pages

- **The home page is the `description` above the sign-up form**, and nothing else
  can be added to it. The form always comes last. The description is markdown and
  takes Buttondown's template tags: `newsletter.recent_public_emails` (a list to
  loop over and slice) and `newsletter.latest_public_email` list published posts.
  Every link in it gets `target="_blank"` and UTM parameters.
- **There is no per-post template.** Content that should appear only on the web
  goes in the post's body inside `{% if medium == 'web' %}…{% endif %}`; it is
  left out of the email.
- **The theme's rules often outrank a skin's.** `.archive__button` is rounded,
  white and upper-case with `!important` on a class selector, which beats a
  universal `*` rule; several form rules use `:is(#subscribe-form, …)`, which
  carries an id's specificity. The subscribe control is a `<button
  type="button">`, so an element-qualified selector for a submit or a link
  matches nothing.
- **The brand link and its icon always point at the newsletter's own home**, so
  neither can link elsewhere.
- **The form's place holds what has happened**, rendered by Buttondown's script:
  - a reader who has just signed up gets a `div.confirmation-email-message`
    ("We just sent you an email…") and an `a.sniper-link-button` to their mail
    provider ("Take me to Gmail"), which no setting turns off;
  - a signed-in reader gets a `span.confirmation-email-message` ("You're already
    subscribed…") and an `a.archive__button` to manage the subscription; the
    form's own action is a `<button>`, so `a.archive__button` there is only that
    link;
  - a recognised reader asked to log in gets `.magic-link-success-message`, which
    the shared base sets in body ink.
- **The form takes no address from the URL**, so a "resend" link can only bring
  the reader back to the form; submitting the same address again sends the
  reminder ([Sign-up and tags](#sign-up-and-tags)). The `debug_status` query
  parameter doesn't render these states for an anonymous visitor.
- **The preferences page** is `.manage-subscription`, server-rendered:
  - the email section holds Save and Unsubscribe in one row;
  - with `tags` enabled, a preferences section follows with a switch per
    `subscriber_editable` tag and an Update button;
  - the RSS section ("Data & feeds") comes last, as four siblings: an
    `hr.section-divider`, an `h2.section-title`, a `.section-subtitle` and a
    `.field-group--buttons` holding the feed link. No setting removes it, and the
    feed stays at `/rss` whether it shows or not.
- **A reader's Buttondown session spans every newsletter on the platform**, so
  test what a stranger sees in a private window. Opened with no session, a bare
  `/management/subscribers/<id>/` address asks the reader to sign in by email.

## Email rendering

- **The modern template prints three things above the body**: the newsletter's
  `icon`, the subject as a heading, and the newsletter's `name`. Removing them
  needs the `naked` or `custom` template, which are paid; a skin can hide them
  instead. Clearing `icon` brings Buttondown's own mark back, and `name` can't be
  blank. `name` also titles the hosted page, the header, the preferences portal
  and the line under the subject in every email.
- **The masthead renders above the email's container**, and the `header` field
  renders inside it, below the subject, so `header` can't put anything above
  Buttondown's title: hide `.newsletter-masthead` and draw the title in `header`.
- **`header` and `footer` don't reach transactional email**: the confirmation,
  reminder and welcome emails carry their own copy of every band.
- **`css` does reach transactional email**, inlined into the confirmation,
  reminder and welcome as well as newsletter issues, so a broad rule lands on
  Buttondown's own transactional footer too. That wrapper uses different classes
  (`.transactional-email-header`, `.transactional-email-footer`) from an issue's,
  so a rule's absent effect on one isn't evidence it didn't apply.
- **Buttondown inlines its own styles after yours.** The body gets
  `background-color:#fafafa !important`, so a page colour must be stated
  `!important` to be the last one emitted; a container's border is emitted as
  longhands after yours, so reset it with longhands, not the shorthand.
- **A template link colour wins over an inline one** unless the skin's rule for
  that link is `!important`.
- **The subject arrives at weight 900** in the masthead heading; only a rule
  matching `h1.subject` changes it.
- **The sender-and-date line under the subject is one text node**, so it can only
  be hidden whole.
- **`{% now "Y" %}` renders at send time**, so a footer's year stays current; a
  year written into a template dates from when it was applied.
- **Web fonts reach few inboxes.** Gmail, Outlook and Yahoo strip them whether
  `@import`ed or declared with `@font-face`; Apple Mail and iOS Mail honour
  `@font-face`. The fallback stack is the design for most readers.
- **Spacing belongs on table cells.** Outlook drops a margin on a table and always
  honours padding on a cell.
- **A transactional email's `text/plain` part is the raw HTML of its body**, so a
  mailbox reader that returns the plain-text part shows markup.

## Testing a send

- **Send each test from a new draft.** Re-sending the same draft with
  `send-draft` returns `200` and delivers nothing.
- **`/emails/{id}/renders` returns the body before templates run**, so it can't
  show a `{% if %}` or `{% now %}` outcome; a delivered test can.
- **Drafts are never public**, so a test draft doesn't reach the archive.
- **Check what actually arrived, not the preview.** The preview and the render
  endpoint show only the body; the masthead, the containing table and the footer
  are added at send time. Send the draft to a mailbox you can read, fetch the
  message raw, and parse it with a MIME library rather than by hand: it is
  `multipart/alternative` and quoted-printable, and slicing at the first boundary
  returns a truncated document that looks like a real answer. Strip the `<style>`
  blocks before searching the body, or a class name matches your own CSS. Links
  are rewritten through Buttondown's click tracker, so a URL won't be found as
  written.
