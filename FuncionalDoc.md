# Especificación Funcional y Técnica

Sistema Autónomo de Generación de Contenido e Integración con YouTube API & Dashboard

**Proyecto:** AutoTube Engine & Control Center
**Perfil Objetivo:** Full-Stack Engineer / Single Developer
**Arquitectura:** Hybrid Low-Cost / Scalable Event-Driven Workers + Node-Based Studio

---

## 1. Resumen Ejecutivo del Sistema

El objetivo del proyecto es construir una plataforma web end-to-end compuesta por un Backend de procesamiento distribuido (Workers + Schedulers), un **Estudio de producción basado en nodos** y un Dashboard de monitoreo y analíticas. El sistema opera en modo Set & Forget para corridas automáticas, y en **modo asistido** cuando el operador necesita controlar cada etapa (importar referencias, componer sujeto + outfit, aprobar artefactos nodo a nodo).

Todo video pasa por una etapa de **revisión manual de calidad (QA)** antes de la publicación. El costo operativo se optimiza con APIs de costo cero por defecto; proveedores de pago se enchufan **por nodo**, de forma opt-in, con estimación de costo, tope por corrida y fallback al proveedor $0 o a espera manual si el API pago falla.

---

## 2. Arquitectura General del Sistema

### 2.1 Diagrama de Flujo de Datos

```
[ Plantilla de grafo / CRON 1 ] --> [ Generation Worker ]
        |                                    |
        v                                    v
[ Estudio (React Flow) ] <--- artefactos --> [ Nodos: Guion / TTS / Visuales / Compose / Render ]
        |                                    |     proveedores $0 (default) o pago (opt-in)
        v                                    v
[ Dashboard KPIs + cola ] <-- PostgreSQL --> [ QA por nodo y/o final ] --> [ YouTube Data API v3 ]

[ CRON 2: Cada 6h ] --> [ Analytics Worker ] --> [ YouTube Analytics API ] --> [ PostgreSQL ]
```

El pipeline lineal de Fase 1 (Gemini → Edge-TTS → Pexels → FFmpeg) se conserva como **grafo por defecto**. El Estudio no reemplaza los servicios del engine: cada nodo invoca el mismo contrato que hoy implementan `ScriptService`, `TtsService`, `VisualsService` y `RenderService`.

### 2.2 Componentes Técnicos Requeridos

- **Backend API & Worker Engine:** Node.js/TypeScript (NestJS + BullMQ). El CLI de Fase 1 ya está en NestJS; no se abre una pista paralela en Python.
- **Base de Datos:** PostgreSQL para persistencia relacional de videos, grafos/plantillas, estados, logs, costos por nodo y métricas.
- **Cola de Tareas (Task Queue):** Redis para encolado y procesamiento asíncrono de renderizado pesado y de nodos pagos.
- **Frontend Estudio:** Next.js + React Flow (`@xyflow/react`, MIT) — canvas de producción (armar, ejecutar y pausar un Short).
- **Frontend Dashboard:** Next.js — KPIs, cola de videos, logs de error y analíticas. No es un editor de nodos.

### 2.3 Estudio de producción vs Dashboard

Son dos superficies distintas; no se fusionan en una sola pantalla.

| Superficie | Rol | Usuario típico |
|---|---|---|
| **Estudio** | Taller gráfico. Un grafo = una plantilla o una corrida. Play global, Play por nodo, drop de archivos, preview de artefactos. | Producción de un Short |
| **Dashboard** | Cola, estados, QA final, KPIs, cuota de YouTube, saldo de APIs. Vista lineal usable también en pantallas chicas. | Monitoreo y publicación |

Decisiones de producto del Estudio:

- **No es un n8n/ComfyUI genérico.** Los tipos de nodo están cerrados al dominio (Guion, TTS, Character, Refs, Pexels, Compose, Ken Burns, Render, más adelante Publish). ComfyUI puede existir después como *un* proveedor del nodo Compose si hay GPU local, no como la UI del programa.
- **Plantilla + corrida:** se edita una plantilla reutilizable (ej. “personaje Ana + fondos Pexels + TTS Álvaro”) y se instancia por tema. Un grafo libre sin validación de cables es fácil de romper (TTS sin guion, render sin audio).
- **Grafo casi fijo con interruptores:** se pueden encender/apagar ramas (Pexels vs refs, auto vs manual, $0 vs pago). Rearmar el pipeline desde cero cada video no es el flujo principal.
- **Play dual:** Play del grafo (corre hasta el primer nodo en `waiting`) y Play de un nodo suelto (regenerar solo el guion o un beat).
- **Desktop-first:** el canvas es de mouse. El QA en celular, si existe, usa la vista lineal del Dashboard.

---

## 3. Módulos y Pipeline de Automatización

### 3.1 Módulo 1: Investigación y Generación de Guion (LLM)

El sistema solicita al modelo (Gemini Flash por defecto, vía un alias estable tipo `gemini-flash-latest` para no depender de una versión fija) la generación de una pieza estructurada en formato estricto JSON. Se le provee un historial de los últimos temas publicados para prevenir duplicidad.

Si la corrida tiene un **character bible** conectado (sección 3.3.2), el prompt incluye identidad, outfits y la instrucción de no cambiar de sujeto entre beats.

**Fallback de proveedor (implementado en Fase 2):** el guion se genera detrás de una interfaz `ScriptProvider` con múltiples implementaciones intercambiables. Si Gemini agota sus reintentos por un error transitorio (rate limit, timeout, 5xx — ver política 3.8), el sistema cae automáticamente a Groq (modelo `llama-3.3-70b-versatile`, también con capa gratuita) antes de marcar el video en `ERROR`. El fallback es opcional: si no hay `GROQ_API_KEY` configurada, el sistema opera solo con Gemini como antes. OpenAI GPT-4o-mini / Claude u otros proveedores pagos se suman como implementaciones más de la misma interfaz (sección 3.10), sin tocar el resto del pipeline.

```json
{
  "titulo": "3 Datos Perturbadores del Espacio",
  "descripcion": "Descubre los secretos más oscuros del universo. #Espacio #Ciencia #Shorts",
  "etiquetas": ["espacio", "ciencia", "curiosidades", "misterio"],
  "guion_locucion": "El espacio no es tan silencioso como crees. En primer lugar...",
  "prompts_visuales": ["deep space galaxy animation", "black hole void concept"],
  "beats_visuales": [
    {
      "prompt": "medium shot of Ana in lab coat, same face as reference",
      "subject_id": "ana-01",
      "outfit_id": "lab",
      "source_hint": "character"
    }
  ]
}
```

`beats_visuales` es opcional: si no hay personaje, el pipeline sigue usando solo `prompts_visuales` contra stock (comportamiento actual de Fase 1).

### 3.2 Módulo 2: Sintetizador de Voz y Marcado Temporal (TTS)

Para mantener costo $0, el pipeline utiliza por defecto la librería edge-tts (Microsoft Edge TTS Service). El contrato del nodo es independiente del proveedor: texto in → MP3 + marcas de tiempo por palabra (word-level timestamps) out. Esas marcas generan un archivo de subtítulos enriquecidos `.ass` con destacado palabra por palabra.

Proveedores alternativos (pago, opt-in en el nodo): ElevenLabs / OpenAI Audio. Deben devolver el mismo contrato (`SynthesizedAudio`). Si el proveedor pago no entrega timestamps por palabra, el nodo falla de forma no transitoria o degrada a timestamps estimados solo si está documentado; no se publica un `.ass` desfasado en silencio.

Voz por defecto en Fase 1: español neutro (`es-ES-AlvaroNeural`), configurable después desde el nodo / Dashboard.

### 3.3 Módulo 3: Recolección Visual (Stock, Librería Local y GenAI)

Tres estrategias, combinables en el mismo grafo (hybrid):

- **Stock ($0, default de Fase 1):** petición a la API de Pexels / Pixabay filtrando videos verticales HD (1080x1920) según palabras clave del guion.
- **Librería local ($0, modo asistido):** el operador importa imágenes/clips propios (sujetos, outfits, escenas ya compuestas). Si un beat tiene archivo local, no se llama a Pexels para ese beat.
- **GenAI (Pay-as-you-go, opt-in):** Fal.ai / Replicate / Higgsfield (u otros con el mismo contrato) sólo en los beats que requieran identidad consistente o animación específica. No se usa GenAI en todos los planos por defecto.

#### 3.3.1 Reglas de Licenciamiento de Assets (Visuales y Audio)

- Restringir la búsqueda de stock a contenido bajo licencia que permita explícitamente uso comercial en plataformas de video monetizadas.
- Para música de fondo, usar únicamente bibliotecas de audio libres de copyright para uso comercial (ej. YouTube Audio Library u otras con licencia explícita para este uso). Nunca usar tracks comerciales, aunque suenen genéricos.
- Registrar en base de datos el ID, fuente y tipo de licencia de cada clip visual y pista de audio utilizados por video, para poder auditar rápidamente ante un reclamo de Content ID.
- Assets locales se registran con `source = 'local'` y notas de origen/licencia cargadas por el operador.
- Antes de publicar, dejar logueados los assets utilizados en ese video específico (trazabilidad por `video_id`).

#### 3.3.2 Librería de referencias, coherencia de sujeto y compose

Objetivo: que el mismo sujeto (cara, cuerpo, ropa) se mantenga entre beats **sin** depender de un API pago.

**Librería persistente** (no por corrida):

```
assets/library/
  subjects/<id>/face.jpg, full.jpg, body.jpg
  outfits/<id>.png
  scenes/<opcional ya compuesto>.jpg
  characters/<id>.json
```

**Character bible** (`characters/ana.json`): identidad, rutas de refs, outfits y una descripción textual que se inyecta al LLM. Un nodo `Character` se conecta a todos los beats de la corrida; cambiar el personaje en ese nodo cambia el sujeto de todo el video.

**Coherencia:** se logra reusando el mismo set de fotos, no generando una cara nueva por plano. El LLM no debe pedir “random scientist”; debe pedir el sujeto fijado.

**Compose (modelo + outfit):** el nodo empareja un still de sujeto con un still de outfit y produce el still del beat. Estrategias, en este orden de adopción:

| Estrategia | Costo | Calidad | Rol |
|---|---|---|---|
| `wait` (default) | $0 | Alta (la define el operador) | El nodo pasa a `waiting`; el operador suelta el compose en el dropzone del nodo |
| `overlay` | $0 (FFmpeg) | Baja/media | Solo si el outfit es PNG con alpha (props, no try-on real) |
| `local-ml` | $0 de API | Alta | Opcional; ComfyUI / IP-Adapter / try-on local si hay GPU |
| `paid-gen` | Pay-as-you-go | Alta | Flux/Kontext, Kling, try-on en Fal/Replicate; opt-in por beat |

No se finge un virtual try-on con overlay tosco como default. Un try-on fotorealista **no** forma parte del camino $0 sin GPU local o sin API paga.

Los stills se convierten a clip con **Ken Burns** (zoom/pan de FFmpeg) para alimentar el render 9:16. El motor de render deja de asumir que todo input es un `.mp4` de stock.

### 3.4 Módulo 4: Motor de Renderizado (FFmpeg Video Engine)

Un script automatizado toma la voz sintetizada, el archivo `.ass` de subtítulos y la secuencia de clips de fondo (video de stock y/o stills con Ken Burns) para ensamblar mediante FFmpeg:

- Ajuste de relación de aspecto vertical 9:16 (1080 x 1920 px) a 60 FPS.
- Superposición y centrado visual de los subtítulos generados.
- Normalización y ajuste del volumen del audio de locución con música de fondo atenuada (*ducking*).

El render se mantiene **local (FFmpeg)**. Creatomate / Shotstack no se adoptan al inicio: el salto de calidad no justifica el costo frente a FFmpeg en la misma máquina que ya corre el worker.

**Fallback de música de fondo (implementado en Fase 2):** si el render con `backgroundMusicPath` (ducking vía `sidechaincompress`) falla, el sistema reintenta automáticamente el mismo render sin música de fondo antes de marcar el video como `RENDER_FAILED`. Esto evita que un problema puntual con la pista de audio (formato inválido, pista corrupta, filtro incompatible) tire abajo un video que por lo demás está listo — se prioriza entregar el video con locución y subtítulos sobre no entregar nada.

### 3.5 Módulo 5: Filtro Automático Anti-Repetición (Pre-QA)

Antes de que un video llegue al estado `READY_FOR_REVIEW`, el guion generado pasa por un chequeo automático de similitud para reducir la carga de QA manual y prevenir patrones de contenido inauténtico/masivo (ver sección 8).

**Algoritmo:**

1. Al generar un guion nuevo, calcular su embedding semántico con un modelo local (ej. `sentence-transformers`, corre en CPU, sin costo de API).
2. Comparar por similitud coseno contra los embeddings de los últimos N videos publicados (N configurable, sugerido 20-30).
3. Si la similitud máxima supera un umbral configurable (sugerido 0.85):
   - Rechazar el guion automáticamente y volver a solicitar generación al LLM, incluyendo en el prompt una instrucción explícita de diferenciarse de los temas/estructuras recientes.
   - Si tras un número máximo de reintentos (sugerido 3) sigue sin bajar del umbral, marcar el video en estado `ERROR` con motivo `REPETITIVE_CONTENT` para revisión manual, en vez de reintentar indefinidamente.
4. Registrar el embedding aprobado en la base de datos (columna `embedding` tipo `vector`, extensión `pgvector` de PostgreSQL) para no recalcular el histórico en cada corrida.
5. Señal complementaria de bajo costo: llevar un registro del tipo de "hook"/apertura usado en los últimos videos (pregunta, dato shock, cifra, anécdota, etc.) y exigirle al LLM en el prompt que no repita el mismo patrón que los últimos 2-3 videos.

Este filtro es una capa automática previa al QA humano (sección 3.6), no un reemplazo: reduce cuántos videos "plantilla" llegan siquiera a revisión manual.

### 3.6 Módulo 6: QA Manual (Gate de Revisión Humana)

Antes de la publicación, todo video generado pasa por un estado `READY_FOR_REVIEW` en el Dashboard, donde un operador humano revisa y aprueba o rechaza manualmente. Este paso es obligatorio hasta perfeccionar prompts, nicho y calidad consistente del pipeline; puede reevaluarse su automatización más adelante.

Con el Estudio, el QA **también puede ocurrir por nodo** (aprobar guion, audio o un beat visual antes del mp4 final). Eso no elimina el gate final de publicación.

**Checklist sugerido de QA:**

- **Variación real entre videos:** evitar que guion, estructura y ritmo se sientan repetitivos o "plantilla" respecto a videos anteriores del canal (YouTube penaliza contenido masivo y repetitivo bajo su política de contenido inauténtico/spam).
- **Valor agregado propio:** el video no debe ser percibido como 100% reciclado (voz leyendo texto sobre stock footage sin ningún aporte de curación, ángulo o edición distintiva).
- **Coherencia de sujeto:** si la plantilla usa character bible, verificar que no cambie la cara/ropa entre planos de forma involuntaria.
- **Metadata no engañosa:** título y thumbnail deben reflejar fielmente el contenido del video (evitar clickbait engañoso, que puede derivar en strike).
- **Etiquetado de contenido sintético/alterado:** marcar el video como generado o alterado por IA cuando la política de YouTube lo requiera (disclosure obligatorio en ciertos casos).
- **Revisión técnica:** verificar sincronización de audio/subtítulos, ausencia de cortes o artefactos de render.
- **Cadencia de publicación:** evitar ráfagas de múltiples uploads simultáneos, especialmente en canales nuevos con poco historial; mantener una cadencia constante y moderada.

### 3.7 Módulo 7: Publicación Directa (YouTube Data API v3)

Una vez aprobado en QA, el worker ejecuta una solicitud POST autenticada vía OAuth 2.0 / Refresh Token hacia la API de YouTube enviando la metadata, portada y archivo `.mp4` renderizado. La publicación se establece por defecto como `PUBLIC`.

### 3.8 Política de Errores y Reintentos

Aplica a todas las etapas del pipeline (3.1 a 3.7 y nodos 3.9–3.10). Objetivo: evitar tanto reintentos infinitos como fallos silenciosos que dejen un video a medias sin que quede registrado.

**Clasificación de errores por etapa:**

| Etapa | Errores transitorios (reintentables) | Errores no transitorios (van a `ERROR`) |
|---|---|---|
| Guion (LLM) | Timeout, rate limit (429) | JSON inválido tras reintentos, contenido bloqueado por filtro de seguridad |
| TTS | Timeout, rate limit | Guion vacío o corrupto; proveedor que no entrega timestamps cuando son obligatorios |
| Visuales (Pexels/Pixabay) | Timeout, rate limit | Sin resultados relevantes para las keywords del guion |
| Compose / refs | — | Falta archivo local en modo `wait` tras timeout de operador (opcional); overlay sin alpha |
| GenAI pago | Timeout, rate limit, 429 | Saldo insuficiente sin fallback configurado; identidad rechazada por safety |
| Render (FFmpeg) | — (los fallos de FFmpeg se tratan como no transitorios por defecto) | Falla de proceso, archivo de salida corrupto o inexistente |
| Publicación (YouTube API) | Timeout, `403 quotaExceeded` (reintentar en el próximo reset) | Error de autenticación, metadata rechazada por políticas |

**Reglas:**

1. **Reintentos automáticos:** solo para errores transitorios, máximo 3 intentos con backoff exponencial (ej. 30s, 2min, 8min). Se agota el máximo → pasa a regla 2.
2. **Errores no transitorios (o transitorios agotados):** el video pasa a estado `ERROR` con un motivo específico en `error_reason` (ej. `INVALID_SCRIPT`, `NO_VISUAL_MATCH`, `RENDER_FAILED`, `TTS_TIMEOUT`, `QUOTA_EXCEEDED`, `REPETITIVE_CONTENT` de la sección 3.5, `PROVIDER_FUNDS`, `WAITING_TIMEOUT`). Nunca se reintenta indefinidamente ni se publica un video incompleto.
3. **Logging:** cada intento (exitoso o fallido) se registra en la tabla `video_logs` (ver sección 6) con etapa, proveedor, costo estimado, timestamp y detalle del error si aplica. El Dashboard filtra por estado `ERROR` como panel de revisión — no hay alertas push en esta fase, el operador humano revisa manualmente (proyecto de un solo desarrollador).
4. **Idempotencia:** un reintento de una etapa no debe duplicar trabajo ya hecho de etapas previas (ej. si falla el render, no se regenera el guion ni el audio si ya existen y son válidos). El `manifest.json` de la corrida es la fuente de verdad de artefactos ya producidos.
5. **Fallback de proveedor:** si un nodo pago responde 429 o saldo 0, no se publica a medias. Según config del nodo: (a) degradar al proveedor $0 del mismo contrato, o (b) pasar el nodo a `waiting` para drop manual. El fallback se loguea.

### 3.9 Estudio por nodos (UI de producción)

El Estudio es la interfaz gráfica del pipeline. Cada caja es una etapa; cada flecha es un artefacto (JSON, mp3, imagen, mp4).

Grafo de referencia (plantilla por defecto):

```
[Tema] ──► [Guion] ──► [TTS] ─────────────────────────────┐
              │                                            │
              ▼                                            ▼
        [Character] ──► [Compose] ──► [Ken Burns] ──► [Render] ──► [Preview]
        [Outfit] ───────┘                 ▲
        [Pexels] ─────────────────────────┘  (fallback / fondos)
```

**Estados de un nodo:** `idle` | `running` | `waiting` | `done` | `error`.

**Modo de ejecución por nodo:** `auto` | `pause` | `override`.

- `auto`: comportamiento actual de Fase 1.
- `pause`: persiste el artefacto, espera aprobación o archivo, y recién ahí habilita el siguiente cable.
- `override`: el operador inyecta un archivo (guion JSON, mp3, imagen, clip) y se salta la generación de ese nodo.

El grafo se serializa como JSON (plantilla reutilizable). Cada corrida escribe un `manifest.json` en `output/run_<id>/` para poder retomar desde cualquier nodo sin regenerar lo anterior (`--resume` en CLI; “Play desde aquí” en el Estudio).

En Fase 1 el equivalente es CLI (`--interactive`, `--resume`, `--refs`). El canvas Next.js + React Flow llega en Fase 3; el contrato de artefactos debe ser el mismo para no reescribir el engine.

### 3.10 Proveedores intercambiables (adapters)

Cada tipo de nodo declara un **contrato** (entradas, salidas) y un **proveedor** que lo implementa. Cambiar de modelo no cambia los cables del grafo.

```
[Guion]     provider: gemini-flash | groq-llama | gpt-4o-mini | claude-*
[TTS]       provider: edge-tts     | elevenlabs  | openai-tts
[Visuales]  provider: pexels       | local-refs  | fal-* | kling | replicate-*
[Compose]   provider: wait         | overlay-png | local-ml | paid-gen
[Render]    provider: ffmpeg
```

En código, un adapter por etapa (el nombre es ilustrativo):

```ts
interface TtsProvider {
  id: 'edge-tts' | 'elevenlabs' | 'openai-tts';
  synthesize(text: string): Promise<SynthesizedAudio>;
}
```

El nodo persiste `{ type: 'tts', provider: 'elevenlabs', voice: '...' }`. Agregar un modelo = una clase nueva. Render y el resto del grafo no se enteran.

**Reglas de costo (obligatorias desde que exista el primer proveedor pago):**

1. Default de toda plantilla nueva: proveedores $0.
2. El nodo muestra estimación de costo **antes** de Play.
3. Tope configurable por corrida y por día; al superarlo el nodo no llama al API pago.
4. Cada llamada registra `provider` + `cost_usd` en `video_logs`.
5. Fallback según sección 3.8 regla 5.

**Dónde un API pago sí vale la pena (y dónde no):**

| Nodo | $0 | Pago que justifica el gasto | Qué gana |
|---|---|---|---|
| Guion | Gemini Flash | GPT-4o-mini / Claude Haiku o Sonnet | JSON más estable, mejor gancho |
| TTS | Edge-TTS | ElevenLabs (o similar) | Voz menos sintético, emoción, clonación |
| Stock | Pexels | Casi nunca | El stock pago no arregla coherencia de cara |
| Personaje / outfit | Fotos locales + `wait` | Flux/Kontext, Kling, try-on en Fal/Replicate | Misma persona y ropa en planos distintos |
| Render | FFmpeg local | Creatomate / Shotstack | No adoptar al inicio |

Patrón barato recomendado: guion y voz en $0 (TTS pago solo si la voz no alcanza); Character con fotos locales; GenAI pago **solo en beats de persona**; fondos en Pexels; render siempre FFmpeg.

En la UI del nodo: tipo fijo + selector **Proveedor** (badge `$0` / `pago`) + campos extra del proveedor (voz, seed, strength). No duplicar cajas “Gemini” vs “GPT” en el canvas.

---

## 4. Matriz de Costos y Estrategia de Sustentabilidad

| Módulo | Opción Base ($0 / Low-Cost) | Opción Escalada / GenAI | Costo Est. por Video (30s) |
|---|---|---|---|
| Guion & Prompts | Gemini Flash (Free Tier), fallback a Groq (Free Tier) | OpenAI GPT-4o-mini / Claude | $0.0000 - $0.0020 USD |
| Locución (TTS) | Edge-TTS (Open Source) | ElevenLabs API | $0.0000 - $0.0150 USD |
| Recursos Visuales | Pexels + librería local | Fal.ai / Replicate / Higgsfield (solo beats de identidad) | $0.0000 - $0.1500 USD |
| Compose sujeto+outfit | `wait` manual / overlay PNG | Try-on o i2v pago | $0.0000 - $0.2000 USD |
| Renderizado | FFmpeg local / VPS | Creatomate / Shotstack API (no al inicio) | $0.0000 - $0.0500 USD |

**Estrategia de Costos:** iniciar el canal operando al 100% en la Opción Base ($0/mes excluyendo el VPS). Activar proveedores pagos **por nodo** en el Estudio (no un switch global ciego) sólo para temáticas de alta conversión ya validadas, o para beats de personaje donde la librería local no alcanza.

> ⚠️ **Nota:** Falta incorporar a esta matriz el costo estimado del VPS/hosting, que hoy no está reflejado.

**Sobre uso de modelos de IA locales para reducir costos:**

- El cálculo de embeddings para el filtro anti-repetición (sección 3.5) corre local vía `sentence-transformers` (CPU, sin costo de API) — se adopta como estándar del pipeline.
- El LLM de generación de guion (sección 3.1) se mantiene en la nube (Gemini Flash free tier) mientras el volumen no supere el free tier. Migrar ese paso a un modelo local (Ollama/Llama/Mistral) no se justifica en esta etapa: el costo de una VPS con GPU decente para correrlo con calidad aceptable probablemente supere lo que se ahorra, y los modelos pequeños son menos confiables generando el JSON estructurado que requiere el pipeline (riesgo de más fallos silenciosos, ver sección 8). Reevaluar solo si el volumen de publicación crece lo suficiente como para exceder el free tier de forma sostenida.
- Compose `local-ml` (ComfyUI / IP-Adapter) es opt-in y asume GPU en la máquina del operador; no es requisito del VPS de producción.

---

## 5. Requerimientos del Dashboard de Control

### 5.1 Vista Principal (KPIs & Métricas Globales)

- Métricas acumuladas de 7, 30 y 90 días: Vistas totales, Tiempo de reproducción, Suscriptores ganados y RPM/Ingresos estimados.
- Gráfico interactivo de evolución de vistas e impresiones por día.
- Indicador de salud del sistema: Estado de workers (Redis Queue), cuota consumida de YouTube API, saldo disponible en servicios de IA y **gasto acumulado por proveedor** (día / corrida).

### 5.2 Vista de Gestión de Videos (Video Table & Logs)

Tabla dinámica de histórico de contenido generado con los siguientes estados:

```
QUEUED → GENERATING_SCRIPT → SYNTHESIZING_AUDIO → RENDERING_VIDEO → READY_FOR_REVIEW → PUBLISHED / REJECTED
              ↓                      ↓                    ↓
      WAITING_FOR_INPUT (cualquier nodo en pause / drop)    ERROR (cualquier etapa)
```

- Reproductores embebidos de previsualización para archivos `.mp4` locales antes o después de la subida.
- Panel de aprobación/rechazo manual para videos en estado `READY_FOR_REVIEW`, con checklist de QA visible (ver sección 3.6).
- Acceso al grafo de la corrida (abrir en Estudio, solo lectura o “Play desde nodo”).
- Ficha detallada con retención promedio, Porcentaje de clics (CTR) y Likes/Comentarios traídos desde la YouTube Analytics API.

### 5.3 Vista Estudio (editor de nodos)

- Canvas React Flow con la plantilla activa y miniatura de artefactos en cada nodo.
- Dropzone en nodos `waiting` (imagen, JSON, audio, clip).
- Selector de proveedor y estimación de costo por nodo.
- Play global / Play nodo / Resume desde `manifest`.
- Validación de cables: no se permite ejecutar Render sin audio y sin al menos un visual.

---

## 6. Esquema de Base de Datos (PostgreSQL)

```sql
-- Tabla de Videos Generados
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_video_id VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    script TEXT NOT NULL,
    tags TEXT[],
    status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    error_reason VARCHAR(50),             -- motivo cuando status = 'ERROR' (ver 3.8), ej. 'RENDER_FAILED'
    video_url TEXT,
    embedding VECTOR(384),                -- requiere extensión pgvector; embedding del guion para filtro anti-repetición (ver 3.5)
    template_id UUID,                     -- plantilla de grafo usada (ver workflow_templates)
    character_id VARCHAR(64),             -- sujeto fijado para coherencia (sección 3.3.2)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT
);

-- Plantillas de grafo (Estudio). Un JSON serializa nodos, cables y provider por nodo.
CREATE TABLE workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    graph_json JSONB NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Logs por intento de etapa (ver política de errores/reintentos, sección 3.8)
CREATE TABLE video_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    stage VARCHAR(30) NOT NULL,           -- 'SCRIPT' | 'TTS' | 'VISUALS' | 'COMPOSE' | 'RENDER' | 'PUBLISH'
    node_id VARCHAR(64),                  -- id del nodo en el grafo, si aplica
    provider VARCHAR(50),                 -- 'gemini-flash' | 'edge-tts' | 'pexels' | 'elevenlabs' | 'local' | ...
    attempt INT NOT NULL DEFAULT 1,
    success BOOLEAN NOT NULL,
    cost_usd DECIMAL(10, 6) DEFAULT 0.000000,
    error_detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Assets utilizados por video (trazabilidad de licencias)
CREATE TABLE video_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    asset_type VARCHAR(20) NOT NULL,      -- 'visual' | 'audio' | 'reference' | 'compose'
    source VARCHAR(50) NOT NULL,          -- 'pexels' | 'pixabay' | 'local' | 'youtube_audio_library' | 'fal' | etc.
    source_asset_id VARCHAR(255),
    license_type VARCHAR(100),
    license_url TEXT,
    subject_id VARCHAR(64),
    outfit_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Métricas (Consolidadas cada 6hs)
CREATE TABLE video_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    views INT DEFAULT 0,
    likes INT DEFAULT 0,
    comments INT DEFAULT 0,
    retention_rate FLOAT DEFAULT 0.0,
    estimated_revenue DECIMAL(10, 4) DEFAULT 0.0000,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. Cuotas y Límites de YouTube Data API v3

> ⚠️ **Nota de verificación:** la información sobre costos de cuota de la API cambia con frecuencia y hay reportes contradictorios sobre cambios recientes (posible reducción del costo de subida de video y/o un "balde" de cuota separado para uploads). Antes de dimensionar el pipeline en base a un número específico de uploads/día, **verificar el estado actual directamente en la Google Cloud Console del proyecto (sección Quotas) y en la documentación oficial de Google**, no en blogs de terceros.

Lo que sí se puede asumir como estable:

- La cuota es por proyecto de Google Cloud (no por API key), y se resetea diariamente a medianoche hora Pacífico.
- Distintas operaciones tienen distinto costo (lecturas más baratas, búsquedas y uploads más caras).
- Si el volumen de publicación planeado excede la cuota default, hay que solicitar aumento de cuota a Google mediante el formulario correspondiente; el proceso de aprobación puede tardar semanas o más y no está garantizado.
- Errores de cuota (`403 quotaExceeded`) bloquean llamadas hasta el reset diario o la aprobación de un aumento.

---

## 8. Riesgos y Consideraciones de Cumplimiento

- **Política de contenido inauténtico/masivo de YouTube:** el sistema debe evitar patrones de publicación que se perciban como spam o contenido reciclado en masa. Mitigado mediante el filtro automático anti-repetición (sección 3.5) y el checklist de QA manual (sección 3.6).
- **Monetización (YouTube Partner Program):** validar los requisitos vigentes de umbral de suscriptores/horas de visualización y las políticas específicas sobre contenido generado o reutilizado en masa, que pueden excluir un canal de la monetización aunque esté activo y publicando.
- **Derechos de autor de assets:** ver sección 3.3.1. Las referencias locales y los composes manuales son responsabilidad del operador (derecho de imagen y licencia de outfits).
- **Manejo de errores y reintentos:** ver política definida en sección 3.8.
- **Gasto de APIs pagos:** sin tope por corrida y sin fallback, el Estudio puede disparar costo en silencio. Mitigado por las reglas de la sección 3.10.

---

## 9. Hoja de Ruta de Implementación (Roadmap)

### Fase 0 — Definiciones previas (antes de escribir código)

No bloquean el arranque técnico, pero condicionan decisiones de diseño de las fases siguientes; resolverlas después es más caro que resolverlas ahora.

- Definir la política de errores y reintentos del pipeline (backoff, máximo de reintentos, dead-letter / estado `ERROR` con motivo, alertas). Afecta directamente el diseño de las tareas de Celery/BullMQ en Fase 2.
- Verificar en Google Cloud Console (sección Quotas) el costo real actual de `videos.insert` y `search.list` para dimensionar cuántos uploads/día son viables sin pedir aumento de cuota. Afecta la cadencia planeada y el diseño del scheduler.
- Estimar costo mensual real de VPS/hosting e incorporarlo a la matriz de costos (sección 4), para validar que el proyecto sea rentable antes de invertir tiempo de desarrollo.
- Confirmar umbral y política vigente de monetización (YPP) para contenido generado/reutilizado, y qué joya de esa política aplica al formato Shorts.

### Fase 1 — CLI Core Pipeline

Script local en NestJS/TypeScript que ejecute el pipeline completo de 1 video (LLM → Edge-TTS → Pexels → FFmpeg), deteniéndose antes de publicar.

- Generación de guion en JSON estricto (sección 3.1).
- Síntesis de voz + timestamps por palabra (sección 3.2).
- Descarga de clips de stock (sección 3.3) + registro de licencias (sección 3.3.1).
- Renderizado final con FFmpeg (sección 3.4).
- Salida: 1 video `.mp4` + metadata, sin publicar. Éxito = poder generar 5-10 videos manualmente y evaluar calidad a ojo antes de automatizar nada.

### Fase 1b — Gates por etapa, librería local y compose (CLI)

Extiende Fase 1 **sin** canvas todavía. El contrato de artefactos debe ser el que después consuma el Estudio.

- `manifest.json` por corrida + `--resume` / `--from <etapa>` (idempotencia).
- `--interactive`: pause / override por etapa.
- `--refs` + `assets/library` + character bible inyectado al prompt.
- Nodo Compose en modo `wait` (drop de archivo) y Ken Burns sobre stills.
- Overlay PNG como extra opcional; `local-ml` y GenAI pago **fuera** de esta fase.

### Fase 2 — Filtro Anti-Repetición + Task Queue ✅ (implementado, validado con Redis real)

- Filtro automático de similitud semántica (sección 3.5): embeddings locales (`@xenova/transformers`, sin costo de API) + comparación por similitud coseno contra histórico + rechazo/regeneración automática con instrucción explícita al LLM. Incluye la señal complementaria de tipo de hook (pregunta/cifra/dato/exclamación) para evitar repetir el mismo estilo de apertura en videos consecutivos.
- Pipeline envuelto en BullMQ (Redis) con separación productor/worker: `ProducerModule` (encola jobs, sin procesar) y `WorkerModule` (consume y ejecuta el pipeline) — evita que un script de solo-encolado termine también actuando como worker.
- CRON 1 (generación diaria) implementado con `@nestjs/schedule`, configurable vía `DAILY_CRON_SCHEDULE`. Las corridas CRON usan la plantilla default en modo `auto` (sin `waiting`).
- Sin reintento automático a nivel de job en BullMQ (`attempts: 1`): los reintentos transitorios ya se manejan dentro de cada etapa (política 3.8); reintentar el pipeline completo violaría la regla de idempotencia (no repetir trabajo ya hecho de etapas previas).
- Histórico de guiones (`data/script-history.json`) y logs de jobs (`data/job-logs.json`) implementados como stores basados en archivo local — interinos hasta que Fase 3 los reemplace por PostgreSQL (`videos.embedding` con pgvector y `video_logs`) sin tocar la lógica del filtro ni del processor.
- Extra (resiliencia agregada tras la implementación inicial): fallback de proveedor de guion Gemini → Groq (ver sección 3.1) y fallback de render sin música de fondo si el ducking falla (ver sección 3.4).

### Fase 3 — Estudio por nodos, Dashboard Base, DB y QA Manual

- Modelar y migrar el esquema de PostgreSQL (sección 6), incluyendo `embedding` (pgvector), `workflow_templates` y columnas de proveedor/costo.
- **Estudio:** Next.js + React Flow (sección 5.3) conectado al engine: tipos de nodo del dominio, Play global / Play nodo, dropzone, selector de proveedor (aunque en esta fase solo estén cableados los $0).
- **Dashboard:** tabla de videos con estados (incluido `WAITING_FOR_INPUT`), reproductor embebido, panel de aprobación/rechazo con el checklist de QA visible (sección 3.6).
- Esta fase es el primer punto en que un humano puede operar el sistema de punta a punta en UI (revisar por nodo y aprobar), aunque la publicación siga siendo manual/fuera del sistema.
- Selección de voz TTS configurable desde el nodo / Dashboard (selector de voces Edge-TTS, ej. por acento/región) en vez de la variable de entorno fija `EDGE_TTS_VOICE` usada en Fase 1. Por defecto en Fase 1 se usa español neutro (`es-ES-AlvaroNeural`).

### Fase 4 — Publicación vía YouTube Data API v3

- Integrar OAuth 2.0 + refresh token y el POST de publicación (sección 3.7).
- Definir visibilidad inicial (evaluar `UNLISTED` con publicación programada vs. `PUBLIC` inmediato, especialmente en los primeros videos del canal, por el riesgo de la sección 8).
- Activar CRON 2 (analítica cada 6h) solo después de tener videos publicados para medir contra.

### Fase 5 — Analytics, proveedores pagos y optimización

- Integrar YouTube Analytics API y persistir en `video_metrics`.
- Dashboard de KPIs (sección 5.1): vistas, retención, RPM, salud del sistema, gasto por proveedor.
- Cablear adapters pagos (sección 3.10) como dropdown del nodo, con estimación, tope y fallback: ElevenLabs para TTS; Fal/Replicate/Kling u equivalente para beats de identidad. No habilitar GenAI en todos los planos por defecto.
- Habilitar de forma opcional/selectiva esos proveedores sólo para temáticas de alta conversión ya validadas con datos reales de esta fase.
