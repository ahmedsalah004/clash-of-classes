# Clash of Classes Content API Worker

This is a standalone Cloudflare Worker for **Clash of Classes** content delivery.
It is intentionally separate from the Tasleya Worker and only provides read-only content endpoints for curriculum packs.

## Environment variables

Set these in your Cloudflare Worker environment (or local `.dev.vars`):

- `CAMBRIDGE_PACKS_CSV_URL`
- `CAMBRIDGE_CATEGORY_PLAN_CSV_URL`
- `CAMBRIDGE_QUESTION_BANK_CSV_URL`
- `AMERICAN_PACKS_CSV_URL`
- `AMERICAN_CATEGORY_PLAN_CSV_URL`
- `AMERICAN_QUESTION_BANK_CSV_URL`

Optional:

- `ALLOWED_ORIGINS` (comma-separated), defaults to local dev + placeholder frontend origin.

## Local development

```bash
cd workers/content-api
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

## Endpoints

- `GET /health`
- `GET /curricula`
- `GET /packs`
- `GET /packs/:packId`

### Response shape for `GET /packs/:packId`

```json
{
  "pack": {
    "id": "matter-01",
    "curriculum_id": "cambridge-stage5-science",
    "name": "Matter Basics",
    "active": true
  },
  "categories": [
    {
      "id": "states-of-matter",
      "name": "States of Matter",
      "questions": [
        {
          "id": "q1",
          "prompt": "...",
          "card_order": 1
        }
      ]
    }
  ]
}
```

## Notes

- CSV parsing handles quoted values and escaped quotes.
- Headers and values are trimmed.
- `active` values are normalized from TRUE/FALSE-like strings.
- Numeric fields normalized: `points`, `difficulty`, `sort_order`, `card_order`.
- Categories and questions are sorted by `sort_order` and `card_order`.
- Missing required environment variables return a clear JSON error.
