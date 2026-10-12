/* ============================================================================
   The memory map.
   ----------------------------------------------------------------------------
   Every place this story actually happened, in order, with the one line that
   belongs to it. Drives both MemoryMap.astro and the chapter index overlay.

   x / y are positions in a 0-100 viewBox over a stylised west-Cebu coastline.
   They start from the real coordinates —

     x = (lon - 123.58) / 0.37 * 100
     y = (10.58 - lat)  / 0.40 * 100

   — but five of these places are all within a few kilometres of Toledo, and
   plotted faithfully they land on top of each other with their labels
   overlapping. The Toledo cluster is therefore fanned out for legibility.
   This is a map of a relationship, not a survey; `coords` keeps the real
   figures for anyone who wants them.

   `date` is the machine-readable value for <time datetime>. `dateLabel` is
   what a reader sees. Where a date is genuinely unknown, `date` is null and
   the entry renders without one rather than inventing a plausible lie.
   ========================================================================= */

export const MILESTONES = [
  {
    id: 'parish',
    chapter: 'i',
    place: 'San Vicente Ferrer Parish',
    area: 'Buanoy, Balamban',
    coords: '10.50°N, 123.71°E',
    x: 35, y: 20,
    date: '2022-05-14',
    dateLabel: 'May 14, 2022',
    title: 'The wedding',
    line: "A cousin's wedding, a borrowed seat, and a whole afternoon of stealing glances across the crowd.",
    media: 'parish/parish',
  },
  {
    id: 'fiesta',
    chapter: 'iii',
    place: 'Toledo City Fiesta',
    area: 'Toledo City',
    coords: '10.38°N, 123.64°E',
    x: 18, y: 46,
    date: '2023-04',
    dateLabel: 'April 2023',
    title: 'The first date',
    line: 'The ferris wheel, the lights from the top, and the walk all the way home still holding hands.',
    media: 'moments/pic12',
  },
  {
    id: 'concert',
    chapter: 'iii',
    place: 'Toledo Sports Center',
    area: 'Toledo City',
    coords: '10.38°N, 123.64°E',
    x: 10, y: 56,
    // The original site said "March 2020", which is two years before they met.
    // Left blank rather than guessed — see the note in the README.
    date: null,
    dateLabel: null,
    title: 'The first concert',
    line: 'One crowd, one song, and she grabbed my hand when it got loud and never let go.',
    media: 'moments/pic10',
  },
  {
    id: 'buwakan',
    chapter: 'iii',
    place: 'Buwakan',
    area: 'Toledo City',
    coords: '10.39°N, 123.65°E',
    x: 26, y: 54,
    date: null,
    dateLabel: null,
    title: 'The flower date',
    line: 'I brought flowers. She outshone every single one of them.',
    media: 'buwakan/buwakan-22',
  },
  {
    id: 'seaside',
    chapter: 'iii',
    place: 'SM Seaside',
    area: 'Cebu City',
    coords: '10.27°N, 123.88°E',
    x: 82, y: 80,
    date: null,
    dateLabel: null,
    title: 'First time on the ice',
    line: 'Both hands on the rail, both eyes on her. Then she let go of the rail and held on to me instead.',
    media: 'ice/ice-01',
  },
  {
    id: 'birthday',
    chapter: 'iii',
    place: 'Parkplace Resort',
    area: 'Toledo City',
    coords: '10.38°N, 123.64°E',
    x: 14, y: 68,
    date: '2024-11',
    dateLabel: 'November 2024',
    title: 'The best birthday',
    line: 'The slides, the racing, the screaming like kids. It was never the cake — it was her being there.',
    media: 'moments/pic2',
  },
  {
    id: 'home',
    chapter: 'iv',
    place: 'Home',
    area: 'Every weekend',
    coords: 'still here',
    x: 30, y: 74,
    date: null,
    dateLabel: 'Every weekend, still',
    title: 'Home, every weekend',
    line: "It is never an easy trip, and she makes it anyway. Everything feels lighter when she's here.",
    media: 'moments/pic26',
  },
];

/** Milestones that carry a confirmed date, for the timeline rail. */
export const DATED = MILESTONES.filter(m => m.date);

/** Day one. Everything on this site counts from here. */
export const BEGAN = '2022-05-14';
