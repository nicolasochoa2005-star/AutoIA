/**
 * Compat: el canvas viejo importaba DomainNodeType desde aquí.
 * El registry cerrado vive en lib/nodes/.
 */
export type { StudioNodeType as DomainNodeType } from './nodes/types';
export type { StudioNodeData as DomainNodeData } from './nodes/template';
export { buildDefaultTemplate } from './nodes/template';
