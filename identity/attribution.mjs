/**
 * The values Casomo's tagged links carry, and the tagger built from them, so
 * every Casomo site and its email signature tag a link the same way. Each
 * value is checked against its declaration in index.d.mts.
 */
import {utmTagger} from "../attribution/tagger.mjs";

/** @import * as Identity from "./index.d.mts" */

/** @type {typeof Identity.CASOMO_UTM} */
export const CASOMO_UTM = Object.freeze({
  // The newsletter, as Buttondown tags it, the email signature, a site's
  // blog, whose footer links back to the site, and the two networks the
  // paid adverts run on.
  sources: Object.freeze(/** @type {const} */ ([
    "casomo", "signature", "blog", "reddit", "facebook",
  ])),
  media: Object.freeze(/** @type {const} */ (["email", "footer", "paid"])),
  // LinkedIn's three accounts.
  content: Object.freeze(/** @type {const} */ (["showcase", "profile", "casomoltd"])),
  // A paid advert, numbered as it is made: ad-1, ad-2.
  campaigns: Object.freeze(/^ad-[1-9]\d*$/),
});

/** A link to a Casomo page, tagged from {@link CASOMO_UTM}.
 *  @type {typeof Identity.tagged} */
export const tagged = utmTagger(CASOMO_UTM);
