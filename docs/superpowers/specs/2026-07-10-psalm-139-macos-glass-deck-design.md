# Psalm 139:23-24 Presentation Redesign

## Goal

Create a polished English PowerPoint for a formal Bible-sharing setting using the user's Psalm 139:23-24 content. The deck must feel contemplative, Christ-centered, and visually designed while maintaining precise text and component alignment after PPTX export.

The production route is the normal `ppt-agent` workflow. The `bible-class` command and skill are out of scope.

## Audience And Use

- Primary setting: formal church or fellowship sharing.
- Audience: adults participating in a Bible study or devotional talk.
- Visible language: English only.
- Presentation mode: 16:9 projection, readable from a room rather than optimized for phone viewing.

## Narrative

The deck moves from David's prayer into interpretation, consequence, and response:

1. `Search Me, God` - minimal title and theme.
2. `The Prayer We Are Studying` - Psalm 139:23-24 and the four verbs: Search, Test, See, Lead.
3. `Why Was David Anxious?` - external danger, internal flaws, full exposure before God, and a crisis of trust.
4. `What Does “Offensive Way” Mean?` - pain-producing paths, false trust, and hidden blind spots.
5. `Where Do These Ways Lead?` - anxiety to control, withdrawal, irritation, self-reliance, and distance from God; surrender opens the way everlasting.
6. `Navigate Busy or Exhausting Times` - connection, takeaway, and two discussion questions.
7. `Make Big Decisions in Life` - motives, surrender, and two discussion questions.
8. `When You Feel You Don’t Hear God` - inner noise, self-reliance, and two discussion questions.
9. `A Simple Group Practice` - Search, Name, Receive grace in Christ, Walk the next faithful step.

## Visual Direction

The approved visual direction is `Modern Liturgical x macOS Glass`.

- Base palette: deep liturgical teal, mist white, warm gold, and restrained sage.
- Typography: modern sans serif for titles and navigation; a readable serif used only for scripture quotations.
- Surfaces: frosted-glass cards, translucent capsule labels, soft shadows, thin borders, and controlled depth.
- Geometry: large architectural circles and arches establish a sacred, contemporary rhythm.
- Christ-centered elements: a subtle cross, light, and path motif. No portrait of Jesus is used.
- The cross appears as a recurring anchor on the title or closing moments, not on every slide.
- Capsules organize sections and short key phrases. They do not become dense navigation or dashboard controls.

## Layout System

- Canvas: 16:9 widescreen.
- Safe area: equal left and right margins, with all content held inside a consistent grid.
- Header line: section capsule on the left, page count on the right.
- Each slide has one primary focal surface and at most two supporting surfaces.
- No cards are nested inside other cards.
- Text boxes use fixed bounds; titles intended for one line must never wrap.
- Body copy is shortened before font sizes are reduced.
- Minimum font sizes: 50 pt deck title, 35 pt slide title, 24 pt callout title, 16 pt body.
- Component coordinates are deterministic and shared through reusable layout helpers.

## Representative Slide Types

### Title

A large translucent glass panel carries the title. A tall capsule-like cross frame creates a Christ-centered visual anchor. The canvas remains calm and spacious.

### Scripture

The scripture quotation occupies the dominant glass panel. A smaller vertical group of four capsules holds Search, Test, See, and Lead. The hierarchy favors the biblical text.

### Interpretation

One large statement or definition is paired with a limited number of supporting capsules. Decorative geometry stays behind content and cannot overlap text.

### Application And Discussion

A solid or translucent topic panel provides context. Two large floating question cards provide discussion prompts. Question numbering uses circular gold markers.

### Closing Practice

A Christ-centered summary panel pairs with four floating practice capsules: Search me, Name what is true, Receive grace in Christ, and Walk the next faithful step.

## Content Constraints

- Use the user's supplied content and screenshots as source material.
- Keep visible slide copy audience-facing; speaker guidance belongs in notes.
- Preserve Psalm 139:23-24 wording used in the source material.
- Avoid presenting interpretive Hebrew claims as more certain than the provided source supports. Phrase the offensive-way explanation pastorally rather than as a technical lexical proof.
- Discussion questions retain the user's original intent while being lightly edited for presentation readability.

## Implementation

- Build the PowerPoint with the normal presentation toolchain and `@oai/artifact-tool` JavaScript modules.
- Use generated or raster visual assets for atmospheric texture or Christ-centered imagery; do not create programmatic illustrations.
- Use native shapes only for layout surfaces, text containers, simple capsules, and structural accents.
- Keep intermediate files outside the repository when possible; the final PPTX is written to the repository output convention.
- Preserve the existing dirty worktree and do not modify unrelated files.

## Verification

- Render every slide to PNG and inspect every slide individually at full size.
- Create a contact sheet for deck-level rhythm only.
- Run the overflow test on the final PPTX.
- Check titles for unintended wrapping.
- Check glass surfaces, borders, and text for clipping or position changes after export.
- Confirm all nine slides are present and readable at 16:9.
- Compare rendered PPTX output with the intended composition, not only the source code coordinates.

## Acceptance Criteria

- The finished deck contains nine English slides covering all requested themes and questions.
- The result clearly reflects the approved modern liturgical and macOS glass direction.
- Christ-centered elements are visible but restrained.
- No unintended overlap, clipping, overflow, or component shift is present in the rendered PPTX.
- The normal `ppt-agent` route is used, with no `bible-class` generation path.
