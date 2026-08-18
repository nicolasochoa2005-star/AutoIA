/**
 * Extrae el código de motivo (`error_reason`, ver FuncionalDoc.md sección 3.8
 * y el esquema de `videos.error_reason`) del mensaje de error lanzado por
 * cada etapa del pipeline. Las etapas lanzan errores con el formato
 * "MOTIVO: detalle" por convención (ver script.service, visuals.service, etc.).
 */
export function classifyErrorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const match = /^([A-Z_]+):/.exec(message);
  return match ? match[1] : 'UNKNOWN_ERROR';
}
