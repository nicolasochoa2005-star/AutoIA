import { ConfigService } from '@nestjs/config';
import { ScriptService } from './script.service';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { parseNarrativeProfile, WORKER_NARRATIVE_PROFILE } from './narrative-profile';
import { applyNarrativeContract } from './script-narrative.validator';
import { GeneratedScript } from '../types/script.types';
import { parseCliArgs } from '../../cli-args';

const BASE_SCRIPT = {
  titulo: 'Titulo de prueba',
  descripcion: 'Desc #test',
  etiquetas: ['a', 'b', 'c', 'd', 'e'],
  prompts_visuales: ['wide shot of a city at dusk'],
};

function autopilotJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    ...BASE_SCRIPT,
    guion_locucion: 'Una locución libre de prueba sin estructura dirigida.',
    ...overrides,
  });
}

function directedJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    ...BASE_SCRIPT,
    hook: '¿Sabías este dato?',
    desarrollo: 'El personaje enfrenta un conflicto breve.',
    climax: 'El giro llega al final.',
    cta: 'Seguí para más.',
    guion_locucion: 'esto no debe quedar',
    ...overrides,
  });
}

function makeService(): ScriptService {
  const config = { get: jest.fn().mockReturnValue(undefined) };
  return new ScriptService(
    {} as GeminiProvider,
    {} as GroqProvider,
    config as unknown as ConfigService,
  );
}

describe('narrative profile default', () => {
  it('parseNarrativeProfile sin valor es autopilot', () => {
    expect(parseNarrativeProfile(undefined)).toBe('autopilot');
    expect(parseNarrativeProfile('')).toBe('autopilot');
    expect(parseNarrativeProfile('autopilot')).toBe('autopilot');
  });

  it('CLI sin --narrative-profile no setea el perfil (queda autopilot)', () => {
    const args = parseCliArgs(['curiosidades del espacio']);
    expect(args.narrativeProfile).toBeUndefined();
    expect(parseNarrativeProfile(args.narrativeProfile)).toBe('autopilot');
  });

  it('CLI --narrative-profile directed lo parsea', () => {
    const args = parseCliArgs(['tema', '--narrative-profile', 'directed']);
    expect(args.narrativeProfile).toBe('directed');
  });

  it('worker siempre usa autopilot', () => {
    expect(WORKER_NARRATIVE_PROFILE).toBe('autopilot');
  });

  it('ScriptService.resolveProfile sin override es autopilot', () => {
    const config = {
      get: jest.fn((_key: string, fallback?: string) => fallback),
    };
    const service = new ScriptService(
      {} as GeminiProvider,
      {} as GroqProvider,
      config as unknown as ConfigService,
    );
    expect(service.resolveProfile()).toBe('autopilot');
  });
});

describe('ScriptService.parseAndValidate autopilot', () => {
  const service = makeService();

  it('acepta JSON actual sin cta y no concatena', () => {
    const script = service.parseAndValidate(autopilotJson(), 'autopilot');
    expect(script.cta).toBeUndefined();
    expect(script.guion_locucion).toBe('Una locución libre de prueba sin estructura dirigida.');
  });

  it('si el LLM manda hook extra lo acepta sin exigirlo', () => {
    const script = service.parseAndValidate(autopilotJson({ hook: 'un extra' }), 'autopilot');
    expect(script.hook).toBe('un extra');
    expect(script.guion_locucion).toBe('Una locución libre de prueba sin estructura dirigida.');
  });
});

describe('ScriptService.parseAndValidate directed', () => {
  const service = makeService();

  it('concatena hook desarrollo climax y cta en guion_locucion', () => {
    const script = service.parseAndValidate(directedJson(), 'directed');
    expect(script.guion_locucion).toBe(
      '¿Sabías este dato? El personaje enfrenta un conflicto breve. El giro llega al final. Seguí para más.',
    );
  });

  it('acepta bloques sin guion_locucion y rellena la concatenación', () => {
    const { guion_locucion: _, ...rest } = JSON.parse(directedJson()) as GeneratedScript & {
      guion_locucion?: string;
    };
    void _;
    const script = service.parseAndValidate(JSON.stringify(rest), 'directed');
    expect(script.guion_locucion).toContain('Seguí para más');
  });

  it('rechaza directed sin cta', () => {
    expect(() =>
      service.parseAndValidate(
        directedJson({ cta: '' }),
        'directed',
      ),
    ).toThrow(/INVALID_SCRIPT/);
  });

  it('rechaza más de 75 palabras', () => {
    const tooLong = Array.from({ length: 76 }, (_, i) => `palabra${i}`).join(' ');
    expect(() =>
      service.parseAndValidate(
        directedJson({
          hook: tooLong,
          desarrollo: 'a',
          climax: 'b',
          cta: 'c',
        }),
        'directed',
      ),
    ).toThrow(/INVALID_SCRIPT/);
  });

  it('rechaza beats cuya duration_s suma 31', () => {
    expect(() =>
      service.parseAndValidate(
        directedJson({
          beats_visuales: [
            { prompt: 'a', duration_s: 16, action: 'camina' },
            { prompt: 'b', duration_s: 15, action: 'mira' },
          ],
        }),
        'directed',
      ),
    ).toThrow(/INVALID_SCRIPT/);
  });
});

describe('applyNarrativeContract autopilot ignora beats incompletos', () => {
  it('no exige duration_s en autopilot', () => {
    const script = applyNarrativeContract(
      {
        ...BASE_SCRIPT,
        guion_locucion: 'libre',
        beats_visuales: [{ prompt: 'a' }],
      },
      'autopilot',
    );
    expect(script.guion_locucion).toBe('libre');
  });
});
