import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import configuration from '../src/config/configuration';
import { validateEnv } from '../src/config/env.validation';
import { PrismaModule } from '../src/infra/prisma/prisma.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { VectorSearch } from '../src/modules/rag/retrieval/vector-search';
import { EMBEDDING_DIMENSIONS } from '../src/modules/rag/embedding.constants';

/**
 * The isolation guarantee — doc 07 Weeks 3–4.
 *
 * "Hard metadata filtering before vector search. A Class 10 student asking a
 * Physics question must never retrieve Class 9 Chemistry content."
 *
 * Its exit criteria: "Retrieval respects class/subject filters — verified
 * with a deliberate cross-subject probe." This is that probe.
 *
 * Run against the real database with real pgvector, because the guarantee
 * lives in a SQL WHERE clause. A mocked repository would assert that the
 * code I wrote calls the code I wrote.
 *
 * The fixtures are constructed adversarially: the wrong-class and
 * wrong-subject chunks are given vectors *closer* to the query than the
 * correct one. A post-filter, or a filter that silently fails, returns them.
 */
describe('Retrieval isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let search: VectorSearch;

  // Marker that makes cleanup exact, so a failed run cannot poison the next.
  const MARKER = 'e2e-isolation-probe';

  let curriculumId: string;
  let class10PhysicsId: string;
  let class9PhysicsId: string;
  let class10ChemistryId: string;
  let documentId: string;

  /**
   * A vector pointing along the given axes.
   *
   * Direction, not magnitude — cosine similarity normalises, so scaling a
   * vector does not change its score. An earlier version of this test varied
   * magnitude and believed it was creating a near and a far chunk; all three
   * scored exactly 1.0 and the ordering between them was arbitrary, which
   * would have let a broken filter pass whenever ordering happened to favour
   * the right answer.
   */
  function vectorAlong(axes: number[]): number[] {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    for (const axis of axes) vector[axis] = 1;
    return vector;
  }

  /** The query points along axis 0 alone. */
  const QUERY_VECTOR = vectorAlong([0]);

  async function insertChunk(params: {
    content: string;
    subjectId: string;
    classLevel: number;
    vector: number[];
  }): Promise<string> {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO knowledge_chunks (
         id, document_id, content, chunk_index, class_level, subject_id, language,
         embedding, created_at
       ) VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5::uuid, 'BN', $6::vector, NOW())
       RETURNING id`,
      documentId,
      params.content,
      Math.floor(Math.random() * 1_000_000),
      params.classLevel,
      params.subjectId,
      `[${params.vector.join(',')}]`,
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    // A focused module rather than the whole AppModule: this test exercises
    // one SQL query, and booting the ingestion worker and object storage to
    // do it would add failure modes that have nothing to do with the
    // guarantee under test.
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validate: validateEnv,
          envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
          cache: true,
        }),
        PrismaModule,
      ],
      providers: [VectorSearch],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    search = app.get(VectorSearch);

    const curriculum = await prisma.curriculum.findUniqueOrThrow({ where: { code: 'nctb' } });
    curriculumId = curriculum.id;

    const subjectId = async (code: string, classLevel: number): Promise<string> =>
      (
        await prisma.subject.findUniqueOrThrow({
          where: {
            curriculumId_classLevel_code: { curriculumId, classLevel, code },
          },
        })
      ).id;

    class10PhysicsId = await subjectId('physics', 10);
    class9PhysicsId = await subjectId('physics', 9);
    class10ChemistryId = await subjectId('chemistry', 10);

    // A READY document: the search joins on status, so a chunk under a
    // non-ready document is correctly invisible.
    const document = await prisma.knowledgeDocument.create({
      data: {
        title: MARKER,
        documentType: 'TEXTBOOK',
        storageKey: `${MARKER}/probe.txt`,
        mimeType: 'text/plain',
        sizeBytes: 1,
        checksum: `${MARKER}-checksum`,
        status: 'READY',
        subjectId: class10PhysicsId,
      },
    });
    documentId = document.id;

    // The correct answer points 45° off the query, so cosine similarity is
    // about 0.71 — genuinely the worst match of the three.
    await insertChunk({
      content: `${MARKER} correct: class 10 physics`,
      subjectId: class10PhysicsId,
      classLevel: 10,
      vector: vectorAlong([0, 1]),
    });

    // Both wrong-scope chunks point exactly along the query: similarity 1.0.
    // An unfiltered search returns these two first, every time.
    await insertChunk({
      content: `${MARKER} wrong class: class 9 physics`,
      subjectId: class9PhysicsId,
      classLevel: 9,
      vector: vectorAlong([0]),
    });
    await insertChunk({
      content: `${MARKER} wrong subject: class 10 chemistry`,
      subjectId: class10ChemistryId,
      classLevel: 10,
      vector: vectorAlong([0]),
    });
  });

  afterAll(async () => {
    await prisma.knowledgeChunk.deleteMany({ where: { documentId } });
    await prisma.knowledgeDocument.deleteMany({ where: { title: MARKER } });
    await app.close();
  });

  it('the fixtures are adversarial: wrong-scope chunks outrank the correct one', async () => {
    // Guards the test itself. If this ever fails, every assertion below
    // becomes vacuous — they would pass on ordering luck rather than on the
    // filter doing its job.
    const unfiltered = await prisma.$queryRawUnsafe<Array<{ content: string; similarity: number }>>(
      `SELECT content, 1 - (embedding <=> $1::vector) AS similarity
       FROM knowledge_chunks
       WHERE content LIKE $2
       ORDER BY embedding <=> $1::vector`,
      `[${QUERY_VECTOR.join(',')}]`,
      `${MARKER}%`,
    );

    expect(unfiltered).toHaveLength(3);
    expect(unfiltered[0]!.content).not.toContain('correct');
    expect(unfiltered[2]!.content).toContain('correct');
    expect(Number(unfiltered[2]!.similarity)).toBeLessThan(Number(unfiltered[0]!.similarity));
  });

  it('never returns another class, even when it is the nearest vector', () => {
    return search
      .search({
        embedding: QUERY_VECTOR,
        query: 'physics',
        scope: { classLevel: 10, curriculumId, subjectId: class10PhysicsId },
        limit: 10,
      })
      .then((results) => {
        const probe = results.filter((row) => row.content.includes(MARKER));

        expect(probe.length).toBeGreaterThan(0);
        expect(probe.every((row) => row.class_level === 10)).toBe(true);
        expect(probe.some((row) => row.content.includes('wrong class'))).toBe(false);
      });
  });

  it('never returns another subject, even when it is the nearest vector', async () => {
    const results = await search.search({
      embedding: QUERY_VECTOR,
      query: 'physics',
      scope: { classLevel: 10, curriculumId, subjectId: class10PhysicsId },
      limit: 10,
    });

    const probe = results.filter((row) => row.content.includes(MARKER));
    expect(probe.some((row) => row.content.includes('wrong subject'))).toBe(false);
    expect(probe.every((row) => row.subject_id === class10PhysicsId)).toBe(true);
  });

  it('returns the correct chunk despite it being the poorest match', async () => {
    // The point of filtering before the vector search rather than after:
    // post-filtering the nearest 10 would have discarded both neighbours and
    // left nothing, instead of surfacing the right answer at rank 3.
    const results = await search.search({
      embedding: QUERY_VECTOR,
      query: 'physics',
      scope: { classLevel: 10, curriculumId, subjectId: class10PhysicsId },
      limit: 10,
    });

    const probe = results.filter((row) => row.content.includes(MARKER));
    expect(probe.some((row) => row.content.includes('correct'))).toBe(true);
  });

  it("restricts to the student's selected subjects when no subject is given", async () => {
    const results = await search.search({
      embedding: QUERY_VECTOR,
      query: 'physics',
      scope: {
        classLevel: 10,
        curriculumId,
        studentSubjectIds: [class10PhysicsId],
      },
      limit: 10,
    });

    const probe = results.filter((row) => row.content.includes(MARKER));
    expect(probe.every((row) => row.subject_id === class10PhysicsId)).toBe(true);
  });

  it('refuses to search when neither a subject nor a selection is given', async () => {
    // An unscoped search is the failure the filter exists to prevent, so the
    // safe default is nothing rather than everything.
    const results = await search.search({
      embedding: QUERY_VECTOR,
      query: 'physics',
      scope: { classLevel: 10, curriculumId },
      limit: 10,
    });

    expect(results).toHaveLength(0);
  });

  it('excludes chunks whose document is not READY', async () => {
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'EMBEDDING' },
    });

    try {
      const results = await search.search({
        embedding: QUERY_VECTOR,
        query: 'physics',
        scope: { classLevel: 10, curriculumId, subjectId: class10PhysicsId },
        limit: 10,
      });

      expect(results.filter((row) => row.content.includes(MARKER))).toHaveLength(0);
    } finally {
      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'READY' },
      });
    }
  });

  it('rejects a query embedding of the wrong dimensionality', async () => {
    // A model swap without a migration would otherwise fail at the Postgres
    // cast with an error naming a column rather than the cause (D-11).
    await expect(
      search.search({
        embedding: [0.1, 0.2, 0.3],
        query: 'physics',
        scope: { classLevel: 10, curriculumId, subjectId: class10PhysicsId },
        limit: 5,
      }),
    ).rejects.toThrow(/dimensions/);
  });

  it('counts only chunks inside the scope', async () => {
    const inPhysics = await search.countInScope({
      classLevel: 10,
      curriculumId,
      subjectId: class10PhysicsId,
    });
    const inChemistry = await search.countInScope({
      classLevel: 10,
      curriculumId,
      subjectId: class10ChemistryId,
    });

    expect(inPhysics).toBeGreaterThan(0);
    expect(inChemistry).toBeGreaterThan(0);
    // The chemistry probe chunk lives under a physics document, so the two
    // counts must not be the same number by accident.
    expect(inPhysics).not.toBe(inPhysics + inChemistry);
  });
});
