/* ============================================================================
   The message — a letter in fourteen small chapters.
   ----------------------------------------------------------------------------
   Copy for src/components/Message.astro, kept here so the component is all
   layout and the words can be edited in one place. Cebuano and English are
   mixed in the original and left exactly as written.
   ========================================================================= */

/** `media` is the photo the index previews on hover; chapters without one show none. */
export const MSG_CHAPTERS = [
  { id: 'msg-c1',  n: '01', t: 'Ka-lucky', media: 'moments/pic31' },
  { id: 'msg-c2',  n: '02', t: 'Sauna ug karon', media: 'moments/pic12' },
  { id: 'msg-c3',  n: '03', t: 'Kung moanhi ka', media: 'moments/pic18' },
  { id: 'msg-c4',  n: '04', t: 'Sa atong room', media: 'moments/pic26' },
  { id: 'msg-c5',  n: '05', t: 'Hinay-hinay', media: 'moments/pic7' },
  { id: 'msg-c6',  n: '06', t: 'Ice skating', media: 'ice/ice-07' },
  { id: 'msg-c7',  n: '07', t: 'Bisan pa sa away' },
  { id: 'msg-c8',  n: '08', t: 'Pasayloa ko' },
  { id: 'msg-c9',  n: '09', t: 'Sa lisod pud' },
  { id: 'msg-c10', n: '10', t: 'Namatikdan nako', media: 'moments/pic29' },
  { id: 'msg-c11', n: '11', t: 'Daghan pa', media: 'moments/pic9' },
  { id: 'msg-c12', n: '12', t: 'Salamat', media: 'moments/pic5' },
  { id: 'msg-c13', n: '13', t: 'Ikaw gihapon' },
  { id: 'msg-c14', n: '14', t: 'Ha, langga?', media: 'moments/pic20' },
];

export const INK_TEXT =
  "You know, usahay maghunahuna ko kung unsa ko ka-lucky nga naa ka sa akong life. If someone asks me what makes me happy, dili man kinahanglan nga dagko nga butang akong mahunahunaan. Sometimes, it's just you being here with me, spending time with me, laughing with me, and making ordinary days feel special. You have no idea how much those little moments mean to me.";

export const TYPED_LINE =
  '“Grabe, ka-happy ba diay nga naa kay someone nga ing-ani ka comfortable kauban.”';

export const STEADY = ['Maglalis.', 'Masuko.', 'Maghilom.', 'Maghilak.'];

export const SORRY = [
  {
    tag: '01 · Sa paghilom',
    body: "I also want to say sorry, langga, sa mga times nga mag-away ta unya mapasagdan tika because I don't want to argue anymore. Usahay, akong hunahuna kay if maghilom na lang ko, basin mahuman na ang away. Pero wala nako mahunahuna nga while I'm trying to avoid the argument, ikaw diay masakitan samot kay murag wala tika tagda. I'm sorry sa mga times nga naghilak ka while I stayed silent or failed to comfort you. I know nga dili lalim nga ang person nga gusto nimong muduol nimo during those moments mao pa nuon ang murag mopahilayo.",
  },
  {
    tag: '02 · Sa imong feelings',
    body: "I'm sorry if sometimes I make you feel nga ikaw ra ang naningkamot nga ma-okay ta. I don't want you to think nga wala koy pake sa imong feelings just because I don't always know how to express mine. The truth is, there are times nga dili ko kabalo unsaon pag-handle sa atong problems, but I know nga that shouldn't be a reason for me to leave you feeling alone. You deserve to be heard, understood, and comforted, even when we're not okay with each other.",
  },
  {
    tag: '03 · Sa siklo',
    body: "I don't want our relationship to become a cycle nga mag-away ta, maghilak ka, mag-sorry ko, then balik na pud ta sa same nga situation. I want us to learn from our mistakes. I want to become better at communicating with you instead of avoiding difficult conversations. If I need time to calm down, I want to learn how to tell you properly and reassure you nga dili tika gipasagdan and that we'll talk about it when we're both ready.",
  },
];

export const MORE_A = ['more city dates', 'more random laag', 'more overnight stays', 'more laughter sa atong room', 'more pictures'];
export const MORE_B = ['more stories', 'more places to visit', 'more dreams to achieve', 'more memories nga kita ra ang nakahibalo sa meaning'];

export const THANKS = [
  { a: 'Thank you', b: 'for being part of my life,', pad: '0' },
  { a: 'for', b: 'the love you give me,', pad: '8vw' },
  { a: 'for', b: 'the time you spend with me,', pad: '16vw' },
  { a: 'and for', b: "all the memories we've already made.", pad: '4vw' },
];

export const WAVE = 'iloveyouuuusomuchhhh palanggaa nakooo';
