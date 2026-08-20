import { wordsFromAlignment } from './elevenlabs-tts.provider';

describe('wordsFromAlignment', () => {
  it('returns empty when ElevenLabs omits timestamps', () => {
    expect(wordsFromAlignment(undefined)).toEqual([]);
    expect(wordsFromAlignment({ characters: [], character_start_times_seconds: [], character_end_times_seconds: [] })).toEqual(
      [],
    );
  });

  it('groups characters into words', () => {
    const words = wordsFromAlignment({
      characters: ['H', 'o', 'l', 'a', ' ', 'm', 'u', 'n', 'd', 'o'],
      character_start_times_seconds: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5],
      character_end_times_seconds: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6],
    });
    expect(words.map((w) => w.word)).toEqual(['Hola', 'mundo']);
    expect(words[0].startMs).toBe(0);
    expect(words[1].endMs).toBe(600);
  });
});
