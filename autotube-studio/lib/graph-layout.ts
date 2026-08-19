import type { Edge, Node } from '@xyflow/react';

/**
 * Tipos de nodo cerrados al dominio (sección 2.3 del doc funcional / spec
 * `studio`): no se permite agregar un tipo de nodo arbitrario de terceros.
 */
export type DomainNodeType = 'character' | 'script' | 'tts' | 'visuals' | 'compose' | 'render' | 'preview';

export interface DomainNodeData {
  label: string;
  nodeType: DomainNodeType;
  [key: string]: unknown;
}

/** Plantilla por defecto: el mismo grafo lineal que corre el CLI, más la rama Character/Compose. */
export function buildDefaultTemplate(): { nodes: Node<DomainNodeData>[]; edges: Edge[] } {
  const nodes: Node<DomainNodeData>[] = [
    { id: 'character', type: 'domain', position: { x: 0, y: 180 }, data: { label: 'Character', nodeType: 'character' } },
    { id: 'script', type: 'domain', position: { x: 260, y: 0 }, data: { label: 'Guion', nodeType: 'script' } },
    { id: 'tts', type: 'domain', position: { x: 520, y: 0 }, data: { label: 'TTS', nodeType: 'tts' } },
    { id: 'visuals', type: 'domain', position: { x: 520, y: 200 }, data: { label: 'Visuales', nodeType: 'visuals' } },
    { id: 'compose', type: 'domain', position: { x: 260, y: 360 }, data: { label: 'Compose', nodeType: 'compose' } },
    { id: 'render', type: 'domain', position: { x: 780, y: 100 }, data: { label: 'Render', nodeType: 'render' } },
    { id: 'preview', type: 'domain', position: { x: 1040, y: 100 }, data: { label: 'Preview', nodeType: 'preview' } },
  ];

  const edges: Edge[] = [
    { id: 'e-character-script', source: 'character', target: 'script' },
    { id: 'e-character-compose', source: 'character', target: 'compose' },
    { id: 'e-script-tts', source: 'script', target: 'tts' },
    { id: 'e-script-visuals', source: 'script', target: 'visuals' },
    { id: 'e-compose-visuals', source: 'compose', target: 'visuals' },
    { id: 'e-tts-render', source: 'tts', target: 'render' },
    { id: 'e-visuals-render', source: 'visuals', target: 'render' },
    { id: 'e-render-preview', source: 'render', target: 'preview' },
  ];

  return { nodes, edges };
}
