-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('TEXTBOOK', 'QUESTION_PAPER', 'NOTE', 'SOLUTION_GUIDE');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'QUEUED', 'EXTRACTING', 'CHUNKING', 'EMBEDDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ContentLanguage" AS ENUM ('BN', 'EN');

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "subject_id" UUID,
    "chapter_id" UUID,
    "document_type" "DocumentType" NOT NULL,
    "source" VARCHAR(255),
    "version" INTEGER NOT NULL DEFAULT 1,
    "storage_key" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "status_detail" TEXT,
    "page_count" INTEGER,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "page_number" INTEGER,
    "section" VARCHAR(255),
    "token_count" INTEGER,
    "class_level" SMALLINT NOT NULL,
    "subject_id" UUID,
    "chapter_id" UUID,
    "topic_id" UUID,
    "language" "ContentLanguage" NOT NULL,
    "metadata" JSONB,
    "embedding" vector(1024),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents"("status");

-- CreateIndex
CREATE INDEX "knowledge_documents_subject_id_chapter_id_idx" ON "knowledge_documents"("subject_id", "chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_checksum_version_key" ON "knowledge_documents"("checksum", "version");

-- CreateIndex
CREATE INDEX "knowledge_chunks_class_level_subject_id_idx" ON "knowledge_chunks"("class_level", "subject_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_chapter_id_idx" ON "knowledge_chunks"("chapter_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_document_id_chunk_index_key" ON "knowledge_chunks"("document_id", "chunk_index");

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- HNSW index on the embedding column — doc 07 §7.6.
--
-- Prisma cannot express pgvector index types, so this is hand-written.
--
-- vector_cosine_ops because retrieval ranks by cosine similarity; an index
-- built for a different operator is silently ignored by the planner, which
-- shows up as "retrieval works but is slow" rather than as an error.
--
-- m = 16, ef_construction = 64 are pgvector's defaults and a reasonable
-- starting point for a corpus of this size (two NCTB chapters in Weeks 3–4,
-- growing to a few tens of thousands of chunks). Revisit when the corpus is
-- real: higher ef_construction buys recall at the cost of build time.
-- ---------------------------------------------------------------------------

CREATE INDEX "knowledge_chunks_embedding_hnsw_idx"
  ON "knowledge_chunks"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Trigram index for the admin chunk inspector. Doc 07 Weeks 3–4 calls the
-- inspector out specifically: "it is how anyone diagnoses bad answers", and
-- diagnosing means searching chunk text for a phrase from a bad reply.
CREATE INDEX "knowledge_chunks_content_trgm_idx"
  ON "knowledge_chunks"
  USING gin ("content" gin_trgm_ops);
