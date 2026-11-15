import { expect } from 'chai';
import { balanceByGenre, interleave, matchGenre } from '../src/services/ai';

const song = (n: number, genre?: string) => ({ id: `id${String(n).padStart(9, '0')}`, title: `T${n}`, artist: `A${n}`, duration: 200, genre });

describe('matchGenre', () => {
  it('matches loose spellings of a requested genre', () => {
    expect(matchGenre('Afrobeats', ['salegy', 'afro'])).to.equal('afro');
    expect(matchGenre('Salégy', ['salegy', 'afro'])).to.equal('salegy');
    expect(matchGenre('afro', ['salegy', 'afrobeats'])).to.equal('afrobeats');
  });
  it('returns null for genres that were not asked for', () => {
    expect(matchGenre('pop', ['salegy', 'afro'])).to.equal(null);
    expect(matchGenre(undefined, ['salegy'])).to.equal(null);
  });
});

describe('balanceByGenre', () => {
  const brief = { genres: [{ name: 'salegy' }, { name: 'afro' }] };

  it('gives each requested genre its share, keeping the AI order', () => {
    const songs = [song(1, 'afro'), song(2, 'salegy'), song(3, 'afro'), song(4, 'afro'), song(5, 'salegy'), song(6, 'afro')];
    const { picks, missing } = balanceByGenre(songs, brief, 4);
    expect(picks.map((s) => s.title)).to.deep.equal(['T1', 'T2', 'T3', 'T5']);
    expect(missing.size).to.equal(0);
  });

  it('reports the genre the AI neglected instead of filling it with the other one', () => {
    // The failure seen in production: "salegy et afro" answered with afrobeats only.
    const songs = Array.from({ length: 10 }, (_, i) => song(i, 'afrobeats'));
    const { picks, missing } = balanceByGenre(songs, brief, 10);
    expect(picks).to.have.length(5);
    expect(missing.get('salegy')).to.equal(5);
  });

  it('keeps off-brief songs aside, as a last resort only', () => {
    const songs = [song(1, 'pop'), song(2, 'salegy'), song(3, 'afro')];
    const { picks, spare } = balanceByGenre(songs, brief, 2);
    expect(picks.map((s) => s.title)).to.deep.equal(['T2', 'T3']);
    expect(spare.map((s) => s.title)).to.deep.equal(['T1']);
  });

  it('honours explicit shares', () => {
    const songs = [...Array.from({ length: 10 }, (_, i) => song(i, 'salegy')), ...Array.from({ length: 10 }, (_, i) => song(20 + i, 'afro'))];
    const { picks } = balanceByGenre(songs, { genres: [{ name: 'salegy', share: 0.7 }, { name: 'afro', share: 0.3 }] }, 10);
    expect(picks.filter((s) => s.genre === 'salegy')).to.have.length(7);
    expect(picks.filter((s) => s.genre === 'afro')).to.have.length(3);
  });

  it('leaves the list untouched when the AI gave no brief', () => {
    const songs = [song(1), song(2), song(3)];
    expect(balanceByGenre(songs, {}, 2).picks).to.deep.equal(songs.slice(0, 2));
  });
});

describe('interleave', () => {
  it('spreads top-ups through the list', () => {
    expect(interleave(['a', 'b', 'c', 'd', 'e'], ['X', 'Y', 'Z', 'W', 'V'])).to.deep.equal(['X', 'a', 'Y', 'b', 'Z', 'c', 'W', 'd', 'V', 'e']);
    expect(interleave(['a', 'b', 'c', 'd'], ['X', 'Y'])).to.deep.equal(['a', 'X', 'b', 'c', 'Y', 'd']);
  });
  it('keeps every item exactly once', () => {
    const out = interleave([1, 2, 3, 4, 5, 6, 7], [10, 20, 30]);
    expect([...out].sort((a, b) => a - b)).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 10, 20, 30]);
  });
  it('handles empty sides', () => {
    expect(interleave([1, 2], [])).to.deep.equal([1, 2]);
    expect(interleave([], [1, 2])).to.deep.equal([1, 2]);
  });
});
