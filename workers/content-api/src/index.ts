interface Env {
  CAMBRIDGE_PACKS_CSV_URL?: string;
  CAMBRIDGE_CATEGORY_PLAN_CSV_URL?: string;
  CAMBRIDGE_QUESTION_BANK_CSV_URL?: string;
  AMERICAN_PACKS_CSV_URL?: string;
  AMERICAN_CATEGORY_PLAN_CSV_URL?: string;
  AMERICAN_QUESTION_BANK_CSV_URL?: string;
  ALLOWED_ORIGINS?: string;
}

type CurriculumId = "cambridge-stage5-science" | "american-grade5-science";

interface CurriculumConfig {
  id: CurriculumId;
  label: string;
  packsUrlVar: keyof Env;
  categoryPlanUrlVar: keyof Env;
  questionBankUrlVar: keyof Env;
}

interface Pack {
  id: string;
  curriculum_id: CurriculumId;
  name: string;
  description: string;
  active: boolean;
  sort_order: number;
  points: number;
  difficulty: number;
  [key: string]: string | number | boolean;
}

interface Category {
  id: string;
  pack_id: string;
  name: string;
  active: boolean;
  sort_order: number;
  [key: string]: string | number | boolean;
}

interface Question {
  id: string;
  pack_id: string;
  category_id: string;
  prompt: string;
  active: boolean;
  card_order: number;
  points: number;
  difficulty: number;
  [key: string]: string | number | boolean;
}

const CURRICULA: CurriculumConfig[] = [
  {
    id: "cambridge-stage5-science",
    label: "Cambridge Stage 5 Science",
    packsUrlVar: "CAMBRIDGE_PACKS_CSV_URL",
    categoryPlanUrlVar: "CAMBRIDGE_CATEGORY_PLAN_CSV_URL",
    questionBankUrlVar: "CAMBRIDGE_QUESTION_BANK_CSV_URL",
  },
  {
    id: "american-grade5-science",
    label: "American Grade 5 Science",
    packsUrlVar: "AMERICAN_PACKS_CSV_URL",
    categoryPlanUrlVar: "AMERICAN_CATEGORY_PLAN_CSV_URL",
    questionBankUrlVar: "AMERICAN_QUESTION_BANK_CSV_URL",
  },
];

const numberKeys = new Set(["points", "difficulty", "sort_order", "card_order"]);

function toJson(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeCell(raw: string): string {
  return raw.trim();
}

function normalizeActive(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y";
}

function normalizeNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.length > 1 || row[0] !== "") {
    rows.push(row);
  }

  return rows;
}

function rowsToObjects(csvText: string): Array<Record<string, string>> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => normalizeHeader(h));

  return rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== "")).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = normalizeCell(row[index] ?? "");
    });
    return record;
  });
}

function normalizeRecord(record: Record<string, string>): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};

  Object.entries(record).forEach(([key, value]) => {
    if (key === "active" || key.endsWith("_active")) {
      output[key] = normalizeActive(value);
      return;
    }

    if (numberKeys.has(key)) {
      output[key] = normalizeNumber(value);
      return;
    }

    output[key] = value;
  });

  return output;
}

function ensureEnvVars(env: Env, vars: Array<keyof Env>): string[] {
  return vars.filter((name) => !env[name] || !String(env[name]).trim()).map(String);
}

async function fetchCsvRows(url: string): Promise<Array<Record<string, string | number | boolean>>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${url} (HTTP ${response.status})`);
  }
  const text = await response.text();
  return rowsToObjects(text).map(normalizeRecord);
}

function makeCorsHeaders(req: Request, env: Env): HeadersInit {
  const fallback = ["http://localhost:5173", "http://127.0.0.1:5173", "https://frontend.example.com"];
  const configured = env.ALLOWED_ORIGINS?.split(",").map((v) => v.trim()).filter(Boolean) ?? [];
  const allowlist = configured.length > 0 ? configured : fallback;
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = allowlist.includes(origin) ? origin : allowlist[0];

  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "Content-Type",
    vary: "Origin",
  };
}

function findByKnownKeys(record: Record<string, string | number | boolean>, keys: string[]): string {
  for (const key of keys) {
    const val = record[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

function findNumericByKnownKeys(record: Record<string, string | number | boolean>, keys: string[]): number {
  for (const key of keys) {
    const val = record[key];
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (typeof val === "string" && val.trim()) return normalizeNumber(val);
  }
  return 0;
}

function mapPack(curriculumId: CurriculumId, record: Record<string, string | number | boolean>): Pack {
  return {
    ...record,
    id: findByKnownKeys(record, ["id", "pack_id", "slug"]),
    curriculum_id: curriculumId,
    name: findByKnownKeys(record, ["name", "pack_title", "title", "pack_id", "id"]),
    description: findByKnownKeys(record, ["description", "recommended_use", "notes"]),
    active: Boolean(record.active),
    sort_order: findNumericByKnownKeys(record, ["sort_order"]),
    points: typeof record.points === "number" ? record.points : 0,
    difficulty: typeof record.difficulty === "number" ? record.difficulty : 0,
  };
}

function mapCategory(record: Record<string, string | number | boolean>): Category {
  return {
    ...record,
    id: findByKnownKeys(record, ["id", "category_id", "slug"]),
    pack_id: findByKnownKeys(record, ["pack_id", "pack", "pack_slug"]),
    name: findByKnownKeys(record, ["name", "category_name", "title"]),
    active: Boolean(record.active),
    sort_order: findNumericByKnownKeys(record, ["sort_order", "category_sort_order", "category_order"]),
  };
}

function mapQuestion(record: Record<string, string | number | boolean>): Question {
  return {
    ...record,
    id: findByKnownKeys(record, ["id", "question_id"]),
    pack_id: findByKnownKeys(record, ["pack_id", "pack", "pack_slug"]),
    category_id: findByKnownKeys(record, ["category_id", "category", "category_slug"]),
    prompt: findByKnownKeys(record, ["prompt", "question_text", "question"]),
    active: Boolean(record.active),
    card_order: typeof record.card_order === "number" ? record.card_order : 0,
    points: typeof record.points === "number" ? record.points : 0,
    difficulty: typeof record.difficulty === "number" ? record.difficulty : 0,
  };
}

async function getAllPacks(env: Env): Promise<Pack[]> {
  const tasks = CURRICULA.map(async (curriculum) => {
    const url = env[curriculum.packsUrlVar] as string;
    const rows = await fetchCsvRows(url);
    return rows.map((row) => mapPack(curriculum.id, row)).filter((pack) => pack.active);
  });

  const nested = await Promise.all(tasks);
  return nested.flat().sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const corsHeaders = makeCorsHeaders(req, env);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(req.url);

    if (url.pathname === "/health" && req.method === "GET") {
      return toJson({ ok: true, service: "clash-content-api" }, 200, corsHeaders);
    }

    if (url.pathname === "/curricula" && req.method === "GET") {
      return toJson({ curricula: CURRICULA.map(({ id, label }) => ({ id, label })) }, 200, corsHeaders);
    }

    const missing = ensureEnvVars(env, [
      "CAMBRIDGE_PACKS_CSV_URL",
      "CAMBRIDGE_CATEGORY_PLAN_CSV_URL",
      "CAMBRIDGE_QUESTION_BANK_CSV_URL",
      "AMERICAN_PACKS_CSV_URL",
      "AMERICAN_CATEGORY_PLAN_CSV_URL",
      "AMERICAN_QUESTION_BANK_CSV_URL",
    ]);

    if (missing.length > 0) {
      return toJson({ error: "Missing required environment variables.", missing }, 500, corsHeaders);
    }

    try {
      if (url.pathname === "/packs" && req.method === "GET") {
        const packs = await getAllPacks(env);
        return toJson({ packs }, 200, corsHeaders);
      }

      const packMatch = url.pathname.match(/^\/packs\/([^/]+)$/);
      if (packMatch && req.method === "GET") {
        const packId = decodeURIComponent(packMatch[1]);
        const packs = await getAllPacks(env);
        const pack = packs.find((p) => p.id === packId);

        if (!pack) {
          return toJson({ error: "Pack not found.", packId }, 404, corsHeaders);
        }

        const curriculum = CURRICULA.find((c) => c.id === pack.curriculum_id)!;
        const [categoryRows, questionRows] = await Promise.all([
          fetchCsvRows(env[curriculum.categoryPlanUrlVar] as string),
          fetchCsvRows(env[curriculum.questionBankUrlVar] as string),
        ]);

        const categories = categoryRows
          .map(mapCategory)
          .filter((category) => category.active && category.pack_id === pack.id)
          .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

        const questions = questionRows
          .map(mapQuestion)
          .filter((question) => question.active && question.pack_id === pack.id)
          .sort((a, b) => a.card_order - b.card_order || a.points - b.points || a.id.localeCompare(b.id));

        const categoriesWithQuestions = categories.map((category) => ({
          ...category,
          questions: questions.filter((q) => q.category_id === category.id),
        }));

        return toJson({ pack, categories: categoriesWithQuestions }, 200, corsHeaders);
      }

      return toJson({ error: "Not found." }, 404, corsHeaders);
    } catch (error) {
      return toJson(
        {
          error: "Failed to load content from CSV sources.",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
        corsHeaders,
      );
    }
  },
};
