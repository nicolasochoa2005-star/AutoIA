# Especificación Funcional y Técnica

Sistema Autónomo de Generación de Contenido e Integración con YouTube API & Dashboard

**Proyecto:** AutoTube Engine & Control Center
**Perfil Objetivo:** Full-Stack Engineer / Single Developer
**Arquitectura:** Hybrid Low-Cost / Scalable Event-Driven Workers

---

## 1. Resumen Ejecutivo del Sistema

El objetivo del proyecto es construir una plataforma web end-to-end compuesta por un Backend de procesamiento distribuido (Workers + Schedulers) y un Dashboard web de monitoreo y analíticas. El sistema opera en modo Set & Forget, generando y editando contenido dinámico (YouTube Shorts), con una etapa de **revisión manual de calidad (QA)** antes de la publicación, optimizando el costo operativo mediante el uso primario de APIs de costo cero o Pay-as-you-go.

---

## 2. Arquitectura General del Sistema

### 2.1 Diagrama de Flujo de Datos

```
[ CRON 1: Diario ] --> [ Generation Worker ] --> [ Gemini / Edge-TTS / Pexels / FFmpeg ] --> [ QA Manual (Dashboard) ] --> [ YouTube Data API v3 ]
                                                                                                        |
[ CRON 2: Cada 6h ] --> [ Analytics Worker ] --> [ YouTube Analytics API ] --> [ PostgreSQL ] <---------┘
                                                                                       |
                                                                                       v
                                                                          [ Dashboard Web Panel ]
```

### 2.2 Componentes Técnicos Requeridos

- **Backend API & Worker Engine:** Python (FastAPI + Celery) o Node.js/TypeScript (Express/NestJS + BullMQ).
- **Base de Datos:** PostgreSQL para persistencia relacional de videos, estados, logs y métricas.
- **Cola de Tareas (Task Queue):** Redis para encolado y procesamiento asíncrono de renderizado pesado.
- **Frontend Dashboard:** React (Next.js) o Streamlit/Reflex para desarrollo acelerado.

---

## 3. Módulos y Pipeline de Automatización

### 3.1 Módulo 1: Investigación y Generación de Guion (LLM)

El sistema solicita al modelo (Gemini Flash, vía el alias `gemini-flash-latest` para no depender de una versión fija / OpenAI GPT-4o-mini) la generación de una pieza estructurada en formato estricto JSON. Se le provee un historial de los últimos temas publicados para prevenir duplicidad.

```json
{
  "titulo": "3 Datos Perturbadores del Espacio",
  "descripcion": "Descubre los secretos más oscuros del universo. #Espacio #Ciencia #Shorts",
  "etiquetas": ["espacio", "ciencia", "curiosidades", "misterio"],
  "guion_locucion": "El espacio no es tan silencioso como crees. En primer lugar...",
  "prompts_visuales": ["deep space galaxy animation", "black hole void concept"]
}
```

### 3.2 Módulo 2: Sintetizador de Voz y Marcado Temporal (TTS)

Para mantener costo $0, el pipeline utiliza la librería edge-tts (Microsoft Edge TTS Service) o la API de ElevenLabs/OpenAI Audio para obtener la locución en MP3 junto con las marcas de tiempo por palabra (word-level timestamps). Estas marcas de tiempo permiten generar dinámicamente un archivo de subtítulos enriquecidos `.ass` con destacado palabra por palabra.

### 3.3 Módulo 3: Recolección Visual (Stock & GenAI)

- **Estrategia Base ($0):** Petición a la API de Pexels / Pixabay filtrando videos verticales HD (1080x1920) según palabras clave del guion.
- **Estrategia GenAI (Pay-as-you-go):** Petición a Higgsfield AI API o Fal.ai/Replicate sólo cuando se requieran clips de animación temática específicos.

#### 3.3.1 Reglas de Licenciamiento de Assets (Visuales y Audio)

- Restringir la búsqueda de stock a contenido bajo licencia que permita explícitamente uso comercial en plataformas de video monetizadas.
- Para música de fondo, usar únicamente bibliotecas de audio libres de copyright para uso comercial (ej. YouTube Audio Library u otras con licencia explícita para este uso). Nunca usar tracks comerciales, aunque suenen genéricos.
- Registrar en base de datos el ID, fuente y tipo de licencia de cada clip visual y pista de audio utilizados por video, para poder auditar rápidamente ante un reclamo de Content ID.
- Antes de publicar, dejar logueados los assets utilizados en ese video específico (trazabilidad por `video_id`).

### 3.4 Módulo 4: Motor de Renderizado (FFmpeg Video Engine)

Un script automatizado toma la voz sintetizada, el archivo `.ass` de subtítulos y la secuencia de clips de fondo para aplicar los siguientes comandos de ensamble mediante FFmpeg:

- Ajuste de relación de aspecto vertical 9:16 (1080 x 1920 px) a 60 FPS.
- Superposición y centrado visual de los subtítulos generados.
- Normalización y ajuste del volumen del audio de locución con música de fondo atenuada (*ducking*).

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

**Checklist sugerido de QA:**

- **Variación real entre videos:** evitar que guion, estructura y ritmo se sientan repetitivos o "plantilla" respecto a videos anteriores del canal (YouTube penaliza contenido masivo y repetitivo bajo su política de contenido inauténtico/spam).
- **Valor agregado propio:** el video no debe ser percibido como 100% reciclado (voz leyendo texto sobre stock footage sin ningún aporte de curación, ángulo o edición distintiva).
- **Metadata no engañosa:** título y thumbnail deben reflejar fielmente el contenido del video (evitar clickbait engañoso, que puede derivar en strike).
- **Etiquetado de contenido sintético/alterado:** marcar el video como generado o alterado por IA cuando la política de YouTube lo requiera (disclosure obligatorio en ciertos casos).
- **Revisión técnica:** verificar sincronización de audio/subtítulos, ausencia de cortes o artefactos de render.
- **Cadencia de publicación:** evitar ráfagas de múltiples uploads simultáneos, especialmente en canales nuevos con poco historial; mantener una cadencia constante y moderada.

### 3.7 Módulo 7: Publicación Directa (YouTube Data API v3)

Una vez aprobado en QA, el worker ejecuta una solicitud POST autenticada vía OAuth 2.0 / Refresh Token hacia la API de YouTube enviando la metadata, portada y archivo `.mp4` renderizado. La publicación se establece por defecto como `PUBLIC`.

### 3.8 Política de Errores y Reintentos

Aplica a todas las etapas del pipeline (3.1 a 3.7). Objetivo: evitar tanto reintentos infinitos como fallos silenciosos que dejen un video a medias sin que quede registrado.

**Clasificación de errores por etapa:**

| Etapa | Errores transitorios (reintentables) | Errores no transitorios (van a `ERROR`) |
|---|---|---|
| Guion (LLM) | Timeout, rate limit (429) | JSON inválido tras reintentos, contenido bloqueado por filtro de seguridad |
| TTS | Timeout, rate limit | Guion vacío o corrupto |
| Visuales (Pexels/Pixabay) | Timeout, rate limit | Sin resultados relevantes para las keywords del guion |
| Render (FFmpeg) | — (los fallos de FFmpeg se tratan como no transitorios por defecto) | Falla de proceso, archivo de salida corrupto o inexistente |
| Publicación (YouTube API) | Timeout, `403 quotaExceeded` (reintentar en el próximo reset) | Error de autenticación, metadata rechazada por políticas |

**Reglas:**

1. **Reintentos automáticos:** solo para errores transitorios, máximo 3 intentos con backoff exponencial (ej. 30s, 2min, 8min). Se agota el máximo → pasa a regla 2.
2. **Errores no transitorios (o transitorios agotados):** el video pasa a estado `ERROR` con un motivo específico en `error_reason` (ej. `INVALID_SCRIPT`, `NO_VISUAL_MATCH`, `RENDER_FAILED`, `TTS_TIMEOUT`, `QUOTA_EXCEEDED`, `REPETITIVE_CONTENT` de la sección 3.5). Nunca se reintenta indefinidamente ni se publica un video incompleto.
3. **Logging:** cada intento (exitoso o fallido) se registra en la tabla `video_logs` (ver sección 6) con etapa, timestamp, y detalle del error si aplica. El Dashboard filtra por estado `ERROR` como panel de revisión — no hay alertas push en esta fase, el operador humano revisa manualmente (proyecto de un solo desarrollador).
4. **Idempotencia:** un reintento de una etapa no debe duplicar trabajo ya hecho de etapas previas (ej. si falla el render, no se regenera el guion ni el audio si ya existen y son válidos).

---

## 4. Matriz de Costos y Estrategia de Sustentabilidad

| Módulo | Opción Base ($0 / Low-Cost) | Opción Escalada / GenAI | Costo Est. por Video (30s) |
|---|---|---|---|
| Guion & Prompts | Gemini Flash (Free Tier) | OpenAI GPT-4o-mini | $0.0000 - $0.0020 USD |
| Locución (TTS) | Edge-TTS (Open Source) | ElevenLabs API | $0.0000 - $0.0150 USD |
| Recursos Visuales | Pexels API (Gratis) | Higgsfield AI API / Fal.ai | $0.0000 - $0.1500 USD |
| Renderizado | FFmpeg local / VPS | Creatomate / Shotstack API | $0.0000 - $0.0500 USD |

**Estrategia de Costos:** Iniciar el canal operando al 100% en la Opción Base ($0/mes excluyendo el VPS). Activar Higgsfield AI o ElevenLabs de manera selectiva mediante switches en el Dashboard sólo para temáticas de alta conversión.

> ⚠️ **Nota:** Falta incorporar a esta matriz el costo estimado del VPS/hosting, que hoy no está reflejado.

**Sobre uso de modelos de IA locales para reducir costos:**

- El cálculo de embeddings para el filtro anti-repetición (sección 3.5) corre local vía `sentence-transformers` (CPU, sin costo de API) — se adopta como estándar del pipeline.
- El LLM de generación de guion (sección 3.1) se mantiene en la nube (Gemini Flash free tier) mientras el volumen no supere el free tier. Migrar ese paso a un modelo local (Ollama/Llama/Mistral) no se justifica en esta etapa: el costo de una VPS con GPU decente para correrlo con calidad aceptable probablemente supere lo que se ahorra, y los modelos pequeños son menos confiables generando el JSON estructurado que requiere el pipeline (riesgo de más fallos silenciosos, ver sección 8). Reevaluar solo si el volumen de publicación crece lo suficiente como para exceder el free tier de forma sostenida.

---

## 5. Requerimientos del Dashboard de Control

### 5.1 Vista Principal (KPIs & Métricas Globales)

- Métricas acumuladas de 7, 30 y 90 días: Vistas totales, Tiempo de reproducción, Suscriptores ganados y RPM/Ingresos estimados.
- Gráfico interactivo de evolución de vistas e impresiones por día.
- Indicador de salud del sistema: Estado de workers (Redis Queue), cuota consumida de YouTube API y saldo disponible en servicios de IA.

### 5.2 Vista de Gestión de Videos (Video Table & Logs)

Tabla dinámica de histórico de contenido generado con los siguientes estados:

```
QUEUED → GENERATING_SCRIPT → SYNTHESIZING_AUDIO → RENDERING_VIDEO → READY_FOR_REVIEW → PUBLISHED / REJECTED
                                                                                              ↓
                                                                                           ERROR (cualquier etapa)
```

- Reproductores embebidos de previsualización para archivos `.mp4` locales antes o después de la subida.
- Panel de aprobación/rechazo manual para videos en estado `READY_FOR_REVIEW`, con checklist de QA visible (ver sección 3.6).
- Ficha detallada con retención promedio, Porcentaje de clics (CTR) y Likes/Comentarios traídos desde la YouTube Analytics API.

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT
);

-- Tabla de Logs por intento de etapa (ver política de errores/reintentos, sección 3.8)
CREATE TABLE video_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    stage VARCHAR(30) NOT NULL,           -- 'SCRIPT' | 'TTS' | 'VISUALS' | 'RENDER' | 'PUBLISH'
    attempt INT NOT NULL DEFAULT 1,
    success BOOLEAN NOT NULL,
    error_detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Assets utilizados por video (trazabilidad de licencias)
CREATE TABLE video_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    asset_type VARCHAR(20) NOT NULL,      -- 'visual' | 'audio'
    source VARCHAR(50) NOT NULL,          -- 'pexels' | 'pixabay' | 'youtube_audio_library' | etc.
    source_asset_id VARCHAR(255),
    license_type VARCHAR(100),
    license_url TEXT,
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
- **Derechos de autor de assets:** ver sección 3.3.1.
- **Manejo de errores y reintentos:** ver política definida en sección 3.8.

---

## 9. Hoja de Ruta de Implementación (Roadmap)

### Fase 0 — Definiciones previas (antes de escribir código)

No bloquean el arranque técnico, pero condicionan decisiones de diseño de las fases siguientes; resolverlas después es más caro que resolverlas ahora.

- Definir la política de errores y reintentos del pipeline (backoff, máximo de reintentos, dead-letter / estado `ERROR` con motivo, alertas). Afecta directamente el diseño de las tareas de Celery/BullMQ en Fase 2.
- Verificar en Google Cloud Console (sección Quotas) el costo real actual de `videos.insert` y `search.list` para dimensionar cuántos uploads/día son viables sin pedir aumento de cuota. Afecta la cadencia planeada y el diseño del scheduler.
- Estimar costo mensual real de VPS/hosting e incorporarlo a la matriz de costos (sección 4), para validar que el proyecto sea rentable antes de invertir tiempo de desarrollo.
- Confirmar umbral y política vigente de monetización (YPP) para contenido generado/reutilizado, y qué joya de esa política aplica al formato Shorts.

### Fase 1 — CLI Core Pipeline

Script local en Python/Node que ejecute el pipeline completo de 1 video (LLM → Edge-TTS → Pexels → FFmpeg), deteniéndose antes de publicar.

- Generación de guion en JSON estricto (sección 3.1).
- Síntesis de voz + timestamps por palabra (sección 3.2).
- Descarga de clips de stock (sección 3.3) + registro de licencias (sección 3.3.1).
- Renderizado final con FFmpeg (sección 3.4).
- Salida: 1 video `.mp4` + metadata, sin publicar. Éxito = poder generar 5-10 videos manualmente y evaluar calidad a ojo antes de automatizar nada.

### Fase 2 — Filtro Anti-Repetición + Task Queue ✅ (implementado, validado con Redis real)

- Filtro automático de similitud semántica (sección 3.5): embeddings locales (`@xenova/transformers`, sin costo de API) + comparación por similitud coseno contra histórico + rechazo/regeneración automática con instrucción explícita al LLM. Incluye la señal complementaria de tipo de hook (pregunta/cifra/dato/exclamación) para evitar repetir el mismo estilo de apertura en videos consecutivos.
- Pipeline envuelto en BullMQ (Redis) con separación productor/worker: `ProducerModule` (encola jobs, sin procesar) y `WorkerModule` (consume y ejecuta el pipeline) — evita que un script de solo-encolado termine también actuando como worker.
- CRON 1 (generación diaria) implementado con `@nestjs/schedule`, configurable vía `DAILY_CRON_SCHEDULE`.
- Sin reintento automático a nivel de job en BullMQ (`attempts: 1`): los reintentos transitorios ya se manejan dentro de cada etapa (política 3.8); reintentar el pipeline completo violaría la regla de idempotencia (no repetir trabajo ya hecho de etapas previas).
- Histórico de guiones (`data/script-history.json`) y logs de jobs (`data/job-logs.json`) implementados como stores basados en archivo local — interinos hasta que Fase 3 los reemplace por PostgreSQL (`videos.embedding` con pgvector y `video_logs`) sin tocar la lógica del filtro ni del processor.

### Fase 3 — Dashboard Base, DB y QA Manual

- Modelar y migrar el esquema de PostgreSQL (sección 6), incluyendo la columna `embedding` (pgvector).
- Frontend (Next.js/Streamlit) conectado a la DB: tabla de videos con estados, reproductor embebido, panel de aprobación/rechazo con el checklist de QA visible (sección 3.6).
- Esta fase es el primer punto en que un humano puede operar el sistema de punta a punta (revisar y aprobar), aunque la publicación siga siendo manual/fuera del sistema.
- Selección de voz TTS configurable desde el Dashboard (selector de voces Edge-TTS, ej. por acento/región) en vez de la variable de entorno fija `EDGE_TTS_VOICE` usada en Fase 1. Por defecto en Fase 1 se usa español neutro (`es-ES-AlvaroNeural`).

### Fase 4 — Publicación vía YouTube Data API v3

- Integrar OAuth 2.0 + refresh token y el POST de publicación (sección 3.7).
- Definir visibilidad inicial (evaluar `UNLISTED` con publicación programada vs. `PUBLIC` inmediato, especialmente en los primeros videos del canal, por el riesgo de la sección 8).
- Activar CRON 2 (analítica cada 6h) solo después de tener videos publicados para medir contra.

### Fase 5 — Analytics y Optimización

- Integrar YouTube Analytics API y persistir en `video_metrics`.
- Dashboard de KPIs (sección 5.1): vistas, retención, RPM, salud del sistema.
- Habilitar de forma opcional/selectiva la generación GenAI (Higgsfield AI / ElevenLabs) vía switches en el Dashboard, solo para temáticas de alta conversión ya validadas con datos reales de Fase 5.
