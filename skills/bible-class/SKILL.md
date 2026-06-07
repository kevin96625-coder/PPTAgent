---
name: bible-class
description: >
  Schema validation and craft-markdown rendering for the /bible-class Sunday-school lesson
  workflow. Use when validating lesson-source.json or lesson-outline.json objects, or when
  rendering a craft.md file from a completed lesson outline.
---

# bible-class skill

## When to use
- Validate a `lesson-source.json` object before writing to RUN_DIR (call `validateLessonSource`).
- Validate a `lesson-outline.json` object after content-core produces it (call `validateLessonOutline`).
- Render `craft.md` text from a finalized `lesson-outline.json` (call `renderCraftMarkdown`).

## Modules

### `lib/lesson_schema.js`

```js
const { validateLessonSource, validateLessonOutline } = require('./lib/lesson_schema');

// Returns { ok: boolean, errors: string[] }
const r = validateLessonSource(lessonSourceObj);
if (!r.ok) throw new Error(r.errors.join('\n'));

const r2 = validateLessonOutline(lessonOutlineObj);
if (!r2.ok) throw new Error(r2.errors.join('\n'));
```

### `lib/craft_writer.js`

```js
const { renderCraftMarkdown } = require('./lib/craft_writer');
const craftText = renderCraftMarkdown(lessonOutlineObj);
// craftText is a Markdown string: craft title, materials list, steps, relation_to_story, memory_verse.
// Write it to ${RUN_DIR}/craft.md.
```

## Data contract references
- `lesson-source.json` schema: see `commands/bible-class.md` §Schema.
- `lesson-outline.json` schema: see `commands/bible-class.md` §Schema.
- Theology rule: outline content must derive ONLY from `lesson-source.json`; do not introduce
  doctrine beyond the 教材. Enforced in `agents/content-core.md` mode=lesson_outline.
