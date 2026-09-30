/**
 * The embedding dimension the corpus is committed to.
 *
 * Doc 07 D-11: "Must handle Bangla. Changing this later means re-embedding
 * the entire corpus — decide once, deliberately."
 *
 * This constant and the `vector(1024)` column in migration
 * `0002_knowledge_base` must agree. Changing it requires:
 *
 *   1. A migration altering the column type and rebuilding the HNSW index.
 *   2. Re-embedding every existing chunk — there is no in-place conversion.
 *
 * 1024 is a placeholder matching common multilingual embedding models. It is
 * not a decision; `packages/eval` makes that one, and this must be reconciled
 * with the winner before any real corpus is ingested.
 */
export const EMBEDDING_DIMENSIONS = 1024;
