# AutoTube Estudio

Interfaz gráfica (Next.js + React Flow) para producir un Short controlando el pipeline nodo a nodo. Ver `openspec/specs/studio/spec.md` y `FuncionalDoc.md` sección 2.3.

## Cómo funciona

El Estudio **no** reimplementa el pipeline: invoca el CLI de `autotube-engine` (`npm run cli -- ... --interactive`) como proceso hijo y lee/escribe directamente en `output/run_<id>/` (manifest, artefactos). Ver `lib/process-manager.ts` y `lib/engine-paths.ts`.

## Requisitos

- `autotube-engine` como carpeta hermana con dependencias instaladas (`npm install` ahí) y `.env` configurado (`GEMINI_API_KEY`, `PEXELS_API_KEY`).
- Node 20+.

## Correr en desarrollo

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). Si `autotube-engine` no es la carpeta hermana `../autotube-engine`, configurar `ENGINE_DIR` en `.env.local`.

## Flujo

1. Elegir tema (y opcionalmente un personaje de `assets/library/characters/*.json`) y crear la corrida.
2. El grafo por defecto (Character → Guion/Compose → TTS/Visuales → Render → Preview) corre en modo `--interactive`: cada etapa pausa antes de generar.
3. **Play** en un nodo en pausa confirma la generación automática. Los nodos con dropzone (Guion, Compose por beat, Render) aceptan que el operador suba el archivo directamente en vez de generarlo.
4. **Regenerar** en un nodo ya completo lo invalida (y a las etapas siguientes) y lo vuelve a correr desde ahí.
