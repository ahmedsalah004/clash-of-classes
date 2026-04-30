import type { Category, Pack, Question } from '../types/game';

const DEFAULT_CONTENT_API_BASE_URL = 'https://clash-content-api.clashofclasses.workers.dev';

export const CONTENT_API_BASE_URL =
  (import.meta.env.VITE_CONTENT_API_BASE_URL as string | undefined)?.trim() || DEFAULT_CONTENT_API_BASE_URL;

interface WorkerPackSummary {
  id?: unknown;
  name?: unknown;
  curriculum_id?: unknown;
  school_track?: unknown;
  curriculum_system?: unknown;
  phase?: unknown;
  level_label?: unknown;
  year_equivalent?: unknown;
  grade_equivalent?: unknown;
  exam_board?: unknown;
  qualification?: unknown;
  syllabus_code?: unknown;
  display_group?: unknown;
}
interface WorkerQuestion { id?: unknown; category_id?: unknown; prompt?: unknown; question_text?: unknown; question?: unknown; answer?: unknown; hint?: unknown; points?: unknown; card_order?: unknown; mcq_options?: unknown; two_answers_options?: unknown; }
interface WorkerCategory { id?: unknown; name?: unknown; questions?: unknown; }
interface WorkerPackResponse { pack?: WorkerPackSummary; categories?: unknown; }


function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
function toNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function toPoints(value: unknown): 100 | 200 | 300 | 400 {
  const points = typeof value === 'number' ? value : Number(value);
  return points === 100 || points === 200 || points === 300 || points === 400 ? points : 100;
}

function toMcqOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).slice(0, 4);
  if (typeof value === 'string') return value.split('|').map((v) => v.trim()).filter(Boolean).slice(0, 4);
  return [];
}

function toTwoAnswers(value: unknown, mcqOptions: string[]): [string, string] {
  if (Array.isArray(value) && value.length >= 2) return [String(value[0]), String(value[1])];
  if (typeof value === 'string') {
    const parsed = value.split('|').map((v) => v.trim()).filter(Boolean);
    if (parsed.length >= 2) return [parsed[0], parsed[1]];
  }
  return [mcqOptions[0] ?? 'Option A', mcqOptions[1] ?? 'Option B'];
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${CONTENT_API_BASE_URL}${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => 'Unable to read response body');
    throw new Error(`Content API request failed (${response.status}) for ${path}. ${body.slice(0, 120)}`);
  }
  return (await response.json()) as T;
}

function mapPackSummary(workerPack: WorkerPackSummary): Pack {
  const id = toNonEmptyString(workerPack.id, 'unknown-pack');
  const title = toNonEmptyString(workerPack.name, id);
  const curriculum = toNonEmptyString(workerPack.curriculum_id, 'unknown-curriculum').toLowerCase();
  const isCambridge = curriculum.includes('cambridge');
  const isAmerican = curriculum.includes('american') || curriculum.includes('us') || curriculum.includes('ngss');
  const isStage5 = curriculum.includes('stage-5') || curriculum.includes('stage5') || curriculum.includes('s5');
  const isGrade5 = curriculum.includes('grade-5') || curriculum.includes('grade5') || curriculum.includes('g5');
  const isScience = curriculum.includes('science');

  const stageLabel = isCambridge
    ? `Cambridge ${isStage5 ? 'Stage 5' : 'Science'}`
    : isAmerican
      ? `American ${isGrade5 ? 'Grade 5' : 'Curriculum'}`
      : 'Classroom Pack';

  const subjectLabel = isScience ? 'Science' : 'Curriculum';

  return {
    id,
    title,
    stageLabel,
    subjectLabel,
    schoolTrack: toOptionalString(workerPack.school_track),
    curriculumSystem: toOptionalString(workerPack.curriculum_system),
    phase: toOptionalString(workerPack.phase),
    levelLabel: toOptionalString(workerPack.level_label),
    yearEquivalent: toOptionalString(workerPack.year_equivalent),
    gradeEquivalent: toOptionalString(workerPack.grade_equivalent),
    examBoard: toOptionalString(workerPack.exam_board),
    qualification: toOptionalString(workerPack.qualification),
    syllabusCode: toOptionalString(workerPack.syllabus_code),
    displayGroup: toOptionalString(workerPack.display_group),
    categories: [],
  };
}

function mapQuestion(workerQuestion: WorkerQuestion, categoryId: string, index: number): Question {
  const mcqOptions = toMcqOptions(workerQuestion.mcq_options);
  return {
    id: toNonEmptyString(workerQuestion.id, `${categoryId}-${index + 1}`),
    categoryId,
    points: toPoints(workerQuestion.points),
    prompt: toNonEmptyString(
      workerQuestion.prompt ?? workerQuestion.question_text ?? workerQuestion.question,
      'Question prompt unavailable.',
    ),
    answer: toNonEmptyString(workerQuestion.answer, 'Teacher model answer unavailable.'),
    hint: toNonEmptyString(workerQuestion.hint, 'Use key vocabulary and explain your reasoning.'),
    mcqOptions: mcqOptions.length > 0 ? mcqOptions : ['Option A', 'Option B', 'Option C', 'Option D'],
    twoAnswersOptions: toTwoAnswers(workerQuestion.two_answers_options, mcqOptions),
  };
}

function mapCategory(workerCategory: WorkerCategory, index: number): Category {
  const id = toNonEmptyString(workerCategory.id, `category-${index + 1}`);
  const title = toNonEmptyString(workerCategory.name, `Category ${index + 1}`);
  const rawQuestions = Array.isArray(workerCategory.questions) ? (workerCategory.questions as WorkerQuestion[]) : [];
  const sortedQuestions = rawQuestions.sort((a, b) => (Number(a.card_order) || 0) - (Number(b.card_order) || 0));
  return { id, title, questions: sortedQuestions.map((q, questionIndex) => mapQuestion(q, id, questionIndex)) };
}

export async function fetchPackSummaries(): Promise<Pack[]> {
  const data = await fetchJson<{ packs?: unknown }>('/packs');
  if (!Array.isArray(data.packs)) throw new Error('Content API /packs response is invalid: expected a packs array.');
  return data.packs.map((item) => mapPackSummary((item ?? {}) as WorkerPackSummary));
}

export async function fetchPackById(packId: string): Promise<Pack> {
  const data = await fetchJson<WorkerPackResponse>(`/packs/${encodeURIComponent(packId)}`);
  const pack = mapPackSummary((data.pack ?? {}) as WorkerPackSummary);
  const categories = Array.isArray(data.categories) ? (data.categories as WorkerCategory[]).map(mapCategory) : [];
  return { ...pack, categories };
}
