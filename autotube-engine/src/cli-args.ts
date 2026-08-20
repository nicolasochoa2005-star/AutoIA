import { StageName } from './pipeline/manifest/manifest.types';
import type { NarrativeProfile } from './pipeline/script/narrative-profile';
import type { RenderSettings } from './pipeline/render/render-settings';

export interface CliArgs {
  topicHint: string;
  resumeDir?: string;
  from?: StageName;
  interactive: boolean;
  characterId?: string;
  ttsProvider?: 'edge-tts' | 'elevenlabs';
  identityProvider?: 'local' | 'fal';
  narrativeProfile?: NarrativeProfile;
  overridePaths: Partial<Record<StageName, string>>;
  promptOverride?: string;
  composeImagePaths: string[];
  backgroundMusicPath?: string;
  render: Partial<RenderSettings>;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = { topicHint: '', interactive: false, overridePaths: {}, composeImagePaths: [], render: {} };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--resume':
        args.resumeDir = argv[++i];
        break;
      case '--from':
        args.from = argv[++i] as StageName;
        break;
      case '--interactive':
        args.interactive = true;
        break;
      case '--character':
        args.characterId = argv[++i];
        break;
      case '--tts-provider':
        args.ttsProvider = argv[++i] as CliArgs['ttsProvider'];
        break;
      case '--identity-provider':
        args.identityProvider = argv[++i] as CliArgs['identityProvider'];
        break;
      case '--narrative-profile':
        args.narrativeProfile = argv[++i] as CliArgs['narrativeProfile'];
        break;
      case '--prompt-override':
        args.promptOverride = argv[++i];
        break;
      case '--compose-image':
        args.composeImagePaths.push(argv[++i]);
        break;
      case '--background-music':
        args.backgroundMusicPath = argv[++i];
        break;
      case '--width':
        args.render.width = Number(argv[++i]);
        break;
      case '--height':
        args.render.height = Number(argv[++i]);
        break;
      case '--fps':
        args.render.fps = Number(argv[++i]);
        break;
      case '--vcodec':
        args.render.vcodec = argv[++i];
        break;
      case '--acodec':
        args.render.acodec = argv[++i];
        break;
      case '--duration':
        args.render.durationSec = Number(argv[++i]);
        break;
      case '--override-script':
        args.overridePaths.script = argv[++i];
        break;
      case '--override-tts':
        args.overridePaths.tts = argv[++i];
        break;
      case '--override-visuals':
        args.overridePaths.visuals = argv[++i];
        break;
      case '--override-render':
        args.overridePaths.render = argv[++i];
        break;
      default:
        positional.push(arg);
    }
  }

  args.topicHint = positional.join(' ');
  return args;
}
