import type {ReactNode} from "react";

/** The frame's starting height, until the widget sizes it to the form; a
 *  host reserves the same space so its page doesn't jump as it loads. */
export declare const TALLY_FRAME_HEIGHT: number;

/** A page's handler for each event a form posts, any of them left out. */
export interface TallyHandlers {
  /** The form was submitted. */
  submitted?: () => void;
  /** The reader reached this page of the form, counted from 1. */
  pageView?: (page: number) => void;
}

/** What a page tells the frame. */
export interface TallyFrameProps {
  formId: string;
  /** The frame's accessible name. */
  title: string;
  /** Hidden fields for the form, in any shape `URLSearchParams` takes (`{}`
   *  for none), or undefined while the page doesn't yet know them: the frame
   *  then holds its space and offers a reader without scripts the form's own
   *  page. */
  hidden: ConstructorParameters<typeof URLSearchParams>[0] | undefined;
  /** The starting height; {@link TALLY_FRAME_HEIGHT} unless given. */
  height?: number;
  /** What the page does on the form's events; never sees the answers. The
   *  frame always calls the latest handlers it was given, so a host may pass
   *  them inline. */
  on?: TallyHandlers;
  /** The link to the form's own page, drawn in the site's style, where the
   *  frame can't load. */
  fallback?: (href: string) => ReactNode;
}

/** A value only the browser knows, for a frame's `hidden`: undefined on the
 *  server and while the page hydrates, then `read()`'s value. `read` must
 *  give an equal value each time it is called. */
export declare function useBrowserValue<T>(read: () => T): T | undefined;

/** A Tally form in the page: the frame, Tally's widget script, the form's own
 *  page where the script is blocked, and its events read down. */
export declare function TallyFrame(props: Readonly<TallyFrameProps>): ReactNode;
