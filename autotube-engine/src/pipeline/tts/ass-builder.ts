import { WordTimestamp } from '../types/script.types';

const ASS_HEADER = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,90,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,0,2,60,60,200,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

function formatAssTime(ms: number): string {
  const totalCs = Math.round(ms / 10);
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Renders one dialogue line per word, highlighting the active word in yellow
 * (SecondaryColour) while the rest of the sentence stays white.
 */
export function buildAssSubtitles(words: WordTimestamp[]): string {
  const lines = words.map((word, index) => {
    const start = formatAssTime(word.startMs);
    const end = formatAssTime(word.endMs);
    const text = `{\\c&H00FFFF&}${word.word}{\\c&HFFFFFF&}`;
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  });

  return ASS_HEADER + lines.join('\n') + '\n';
}
