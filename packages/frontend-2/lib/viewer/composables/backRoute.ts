/**
 * Remembers which page the user was on right before entering the model viewer, so the
 * viewer's "go back" button can return exactly there.
 *
 * We can't rely on `window.history.back()` for this: while the viewer is in use it pushes
 * hash-only history entries onto itself (isolating objects, saved views, threads, ...),
 * so going back once would just walk through those instead of leaving the viewer.
 */
export const useViewerBackRoute = () =>
  useState<string | undefined>('viewer-back-route', () => undefined)
