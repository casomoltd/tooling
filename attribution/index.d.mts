/** The query parameters a tag is written as, for a site that reads the tags
 *  back (a contact form keeping them) to name them from. */
export declare const UTM_PARAMS: {
  readonly source: "utm_source";
  readonly medium: "utm_medium";
  readonly content: "utm_content";
};

/** The values a site's tagged links may carry, by parameter. */
export interface UtmLists<S extends string, M extends string, C extends string> {
  /** Where the visit came from. */
  readonly sources: readonly S[];
  /** The kind of channel. */
  readonly media: readonly M[];
  /** Which of one source's several accounts. */
  readonly content: readonly C[];
}

/** One link's tags. */
export interface UtmTags<S extends string, M extends string, C extends string> {
  source: S;
  medium: M;
  content?: C;
}

/** A function that adds tags from these lists to a link, refusing any value
 *  the lists don't hold. */
export declare function utmTagger<S extends string, M extends string, C extends string>(
  lists: UtmLists<S, M, C>,
): (url: string, tags: UtmTags<S, M, C>) => string;
