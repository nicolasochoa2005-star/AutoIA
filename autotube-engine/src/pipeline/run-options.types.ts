import { StageModesConfig, StageName } from './manifest/manifest.types';

export interface RunOptions {
  topicHint: string;
  runDir: string;
  modes: StageModesConfig;
  characterId?: string;
  /** Ruta provista por el operador para copiar dentro del slot de la etapa en modo `override`. */
  overridePaths?: Partial<Record<StageName, string>>;
  /** Si se pasa junto a --resume, fuerza a regenerar esta etapa y las siguientes. */
  resumeFrom?: StageName;
  /** Si es una corrida `--resume`, el manifest ya existente a continuar. */
  resumeManifestPresent?: boolean;
}
