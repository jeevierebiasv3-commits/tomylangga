/* ============================================================================
   Our soundtrack.
   ----------------------------------------------------------------------------
   SLOT FOR JEEVIE — the five tracks below are still the placeholders the old
   site shipped with ("Artist name"). Replace `artist` on each one, and change
   `title` or `caption` if a different song belongs to that moment.

   Anything left with `artist: null` renders as a quiet, deliberate blank in
   the tracklist rather than as a broken row, so the section is presentable
   until you get to it.
   ========================================================================= */

export const SONGS = [
  { n: '01', title: 'The First One',  artist: null, caption: 'our first drive' },
  { n: '02', title: 'Slow Dance',     artist: null, caption: 'the kitchen, midnight' },
  { n: '03', title: 'Long Way Home',  artist: null, caption: 'every road trip' },
  { n: '04', title: '2 A.M.',         artist: null, caption: 'the calls that never ended' },
  { n: '05', title: 'Ours',           artist: null, caption: "the one that's just us" },
];

/** True once at least one real artist has been filled in. */
export const HAS_SONGS = SONGS.some(s => s.artist);
