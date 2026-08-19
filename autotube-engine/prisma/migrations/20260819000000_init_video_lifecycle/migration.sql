-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM (
  'QUEUED',
  'GENERATING_SCRIPT',
  'SYNTHESIZING_AUDIO',
  'COLLECTING_VISUALS',
  'RENDERING_VIDEO',
  'WAITING_FOR_INPUT',
  'READY_FOR_REVIEW',
  'ERROR'
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "graph_json" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "youtube_video_id" VARCHAR(50),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "script" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "VideoStatus" NOT NULL DEFAULT 'QUEUED',
    "error_reason" VARCHAR(50),
    "video_url" TEXT,
    "run_dir" TEXT,
    "hook_type" VARCHAR(40),
    "embedding" vector(384),
    "template_id" UUID,
    "character_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "reviewed_by" VARCHAR(100),
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" TEXT,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "stage" VARCHAR(30) NOT NULL,
    "node_id" VARCHAR(64),
    "provider" VARCHAR(50),
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "success" BOOLEAN NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "error_detail" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "asset_type" VARCHAR(20) NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "source_asset_id" VARCHAR(255),
    "license_type" VARCHAR(100),
    "license_url" TEXT,
    "subject_id" VARCHAR(64),
    "outfit_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workflow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_logs" ADD CONSTRAINT "video_logs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
