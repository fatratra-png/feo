import { expect } from 'chai';
import { extractMetadata } from '../src/lib/metadata';

/** Real YouTube uploads (title, channel, search query) → what FEO should display. */
const CASES: [title: string, channel: string, hint: string | undefined, artist: string, song: string][] = [
  // Brackets go as a whole: they used to leave "PRESTIGE2025)" / "Anaopar Mayash. Studio)".
  ['VAIAVY CHILA - TSISY PRESTIGE (Official Video 2025)', 'Vaiavy Chila and HIRA TIAKO', 'Vaiavy Chila', 'Vaiavy Chila', 'Tsisy Prestige'],
  ['VAIAVY CHILA - Tsy Ambelako Hampirafy Anao (Clip Officiel par Mayash. Studio)', 'TSITOHAINA Mayash', undefined, 'Vaiavy Chila', 'Tsy Ambelako Hampirafy Anao'],
  // A query word inside the title does not make it the artist.
  ['Mamy Gotso - Asio tsapiky amzay', "Emission Gasik'Arts", 'tsapiky', 'Mamy Gotso', 'Asio tsapiky amzay'],
  ['Dj Vaaza x Vaydah - tete tsapiky 2025 ( gasy mixe)', 'DJ Vaaza Official', 'tsapiky', 'Dj Vaaza x Vaydah', 'tete tsapiky 2025'],
  // "Artist- Title" (no space before the dash).
  ['Mahaleo- Hay hay', 'Rino minato', 'mahaleo', 'Mahaleo', 'Hay hay'],
  ['Ninie Doniah- Anatra', 'Hakami Azida', undefined, 'Ninie Doniah', 'Anatra'],
  // The searched artist leads a title without separator, uploaded by a fan channel.
  ['Vaiavy Chila Garamaso', 'zahogasymada', 'Vaiavy Chila', 'Vaiavy Chila', 'Garamaso'],
  ['NINIE DONIAH   MANDIADIASA   [ CLIP GASY ]', 'MADAGASIKARA ALEFA MOZIKA', 'Ninie Doniah', 'Ninie Doniah', 'Mandiadiasa'],
  // Promotion after "//" or "|", Malagasy "nouveauté clip gasy" mentions, French "Officiel" channels.
  ['Ninie Doniah - Koresy  // Nouveauté Gasy 2012', 'Ninie Doniah Officiel', undefined, 'Ninie Doniah', 'Koresy'],
  ['VAIAVY CHILA - Mama Miderange | NOUVEAUTE CLIP GASY 2020 | PREMIUM MUSIC COULEUR TROPICAL', 'MUSIC COULEUR TROPICAL', undefined, 'Vaiavy Chila', 'Mama Miderange'],
  ['Wawa Salegy - Ao zay - Clip officiel', 'Wawa Salegy', undefined, 'Wawa Salegy', 'Ao zay'],
  // "ft." stops at the wide gap instead of swallowing the title.
  ['NINIE DONIAH ft CLO MAHAJANGA   Fiainana an-dafy Nouveauté Clip Gasy 2012', 'Ninie Doniah Officiel', 'Ninie Doniah', 'Ninie Doniah, Clo Mahajanga', 'Fiainana an-dafy'],
  ['Wizkid - Essence (Official Video) ft. Tems', 'WizkidVEVO', undefined, 'Wizkid, Tems', 'Essence'],
  // Artist from the channel, artist name repeated in a live title.
  ['Rafahafahana', 'Mahaleo official ', undefined, 'Mahaleo', 'Rafahafahana'],
  ['SOMAMBISAMBY Mahaleo Live @ Olympia', 'Mahaleo official ', undefined, 'Mahaleo', 'Somambisamby (Live)'],
  // "Title BY Artist  2023"
  ['MANDRIAMPOTOTSY TSAPIKY BY Noudou Guitar  2023', 'MAESTRO SALVADOR', undefined, 'Noudou Guitar', 'Mandriampototsy Tsapiky'],
  // Shouting is toned down, short tokens kept.
  ['DJ ZAYON - SALEGY MANONGA DOANY', 'DJ ZAYON PROD', undefined, 'DJ Zayon', 'Salegy Manonga Doany'],
  // Mixed case is left alone.
  ['Kizz Daniel, EMPIRE - Cough (Official Video)', 'Kizz Daniel', undefined, 'Kizz Daniel, EMPIRE', 'Cough'],
  // Word-bounded noise: "Mahdi" keeps its "hd".
  ['Mahdi - Thundersha (HD)', 'Mahdi', undefined, 'Mahdi', 'Thundersha'],
  ['Rim-Ka - GLITA (Official Video Music)', 'Rim-ka', undefined, 'Rim-Ka', 'Glita'],
  ['Vololona Lyrics', 'Mahaleo official', undefined, 'Mahaleo', 'Vololona'],
  ['Hody amin i ramalala - Rossy (lyrics)', "Doom's harmony", 'Rossy', 'Rossy', 'Hody amin i ramalala'],
];

describe('extractMetadata on real uploads', () => {
  for (const [raw, channel, hint, artist, title] of CASES) {
    it(`${raw}  →  ${artist} — ${title}`, () => {
      expect(extractMetadata(raw, channel, hint)).to.deep.equal({ artist, title });
    });
  }

  it('does not take a genre search for an artist name', () => {
    expect(extractMetadata('TSAPIKY BONNE ANNE 2027', 'H2L EVENT', 'tsapiky').artist).to.equal('H2L Event');
  });
});
