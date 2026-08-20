-- CreateTable
CREATE TABLE "video_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "retention_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimated_revenue" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_metrics_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "video_metrics" ADD CONSTRAINT "video_metrics_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
