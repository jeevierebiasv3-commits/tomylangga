/* ============================================================================
   Chapter III, movement four — the guided tour.
   ----------------------------------------------------------------------------
   Nine stops, nine short silent clips. The writing here is some of the best on
   the site and the old build only ever used it as an aria-label; it is now
   rendered.

   Intrinsic dimensions come from the media manifest, so there is no guessing
   and nothing is upscaled. The stop numbering and the file numbering diverge:
   tour-06 was never trimmed from the source, and tour-05 was dropped from the
   tour. That is deliberate, not a gap.
   ========================================================================= */

export const STOPS = [
  {
    id: '01', media: 'tour/tour-01',
    tag: 'Toledo City', place: 'Toledo',
    title: 'Toledo City Fiesta',
    line: 'the ferris wheel, the lights from the top, the walk all the way home.',
    note: 'first date',
    alt: 'The ferris wheel at the Toledo City fiesta on the night of their first date.',
  },
  {
    id: '02', media: 'tour/tour-02',
    tag: 'ours only', place: 'The handshake',
    title: 'Our handshake',
    line: 'we made one up, swore we would remember it, and forgot it immediately.',
    note: 'still forgotten',
    alt: 'The two of them attempting their own handshake and losing track of it halfway.',
  },
  {
    id: '03', media: 'tour/tour-03',
    tag: 'Toledo City', place: 'Megadome',
    title: 'The estitik outfit date',
    line: 'dressed up for the Megadome — with her cousin third-wheeling the whole way.',
    note: 'fit check',
    alt: 'Dressed up at the Megadome, with her cousin along for the day.',
  },
  {
    id: '04', media: 'tour/tour-04',
    tag: 'Toledo Sports Center', place: 'Sports Center',
    title: 'The first concert',
    line: 'one crowd, one song, and you never let go.',
    note: 'our song',
    alt: 'The crowd at the Toledo Sports Center during the concert.',
  },
  {
    id: '05', media: 'tour/tour-07',
    tag: 'SM Seaside, Cebu', place: 'Seaside',
    title: 'First time on the ice',
    line: 'both hands on the rail, both eyes on you.',
    note: 'ice skating',
    alt: 'Stepping onto the ice rink at SM Seaside for the first time.',
  },
  {
    id: '06', media: 'tour/tour-08',
    tag: 'SM Seaside, Cebu', place: 'Seaside',
    title: 'The first lap',
    line: 'slow, wobbly, laughing the whole way around.',
    note: 'lap one',
    alt: 'A slow, unsteady first lap around the rink.',
  },
  {
    id: '07', media: 'tour/tour-09',
    tag: 'SM Seaside, Cebu', place: 'Seaside',
    title: 'The first mall date',
    line: 'nobody there knew us — and we have never felt that free.',
    note: 'just us',
    alt: 'Walking through the mall together, certain nobody would recognise them.',
  },
  {
    id: '08', media: 'tour/tour-10',
    tag: 'SM Seaside, Cebu', place: 'Seaside',
    title: 'One more round',
    line: '“last one” — said four times, meant none of them.',
    note: 'closing time',
    alt: 'Another lap around the rink, near closing time.',
  },
  {
    id: '09', media: 'tour/tour-11',
    tag: 'the crowd', place: 'The concert',
    title: 'The concert date',
    line: 'back in the noise again — and still only looking at you.',
    note: 'loud, and ours',
    alt: 'The two of them at a concert, surrounded by the crowd.',
  },
];
