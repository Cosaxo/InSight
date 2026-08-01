// The question-bank seed, extracted from the seedContentV2 callable so the
// SAME code can run from two places without drifting: the callable (an
// operator signed into the app) and scripts/seed-prod.mjs (the deploy
// workflow's post-deploy step, D36). Runtime-agnostic on purpose — no
// firebase-functions imports, the logger arrives as a parameter — because
// the CI caller loads this from functions/lib with plain firebase-admin.
import { FieldValue, type Firestore } from "firebase-admin/firestore";

export interface SeedQuestion {
  id: string;
  surface: string;
  seq: number;
  type: string;
  domain: string | null;
  prompt: string;
  options: string[];
  topic: string | null;
  axis: string | null;
  test: string | null;
}

export async function seedQuestions(
  db: Firestore,
  questions: SeedQuestion[],
  log: (msg: string) => void = () => {},
): Promise<{ written: number; created: number }> {
  const refs = questions.map((q) => db.collection("v2_questions").doc(q.id));
  // `active` is the operational kill switch — the seed must never flip a
  // question ops disabled back on, so it is only written on first create.
  const existing = new Set(
    (await db.getAll(...refs)).filter((s) => s.exists).map((s) => s.id),
  );
  let batch = db.batch();
  let inBatch = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const payload: Record<string, unknown> = {
      surface: q.surface,
      seq: q.seq,
      type: q.type,
      // The aggregate trigger reads the question doc's `domain` to pick the
      // catalogue an `entity` answer validates against (D14/D15) — the seed
      // must transport it or live catalog questions can never aggregate.
      domain: q.domain,
      prompt: q.prompt,
      options: q.options,
      topic: q.topic,
      axis: q.axis,
      test: q.test,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!existing.has(q.id)) payload.active = true;
    batch.set(refs[i], payload, { merge: true });
    // Firestore batches cap at 500 ops.
    if (++inBatch === 450) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();
  // Bump the content revision — clients cache the question bank locally
  // and refetch only when this changes (one meta read per boot instead
  // of ~190 bank reads).
  await db.collection("v2_meta").doc("app").set(
    { contentRev: FieldValue.serverTimestamp() },
    { merge: true },
  );
  log(`seeded ${questions.length} questions (${existing.size} pre-existing)`);
  return { written: questions.length, created: questions.length - existing.size };
}
