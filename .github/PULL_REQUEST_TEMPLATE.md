<!-- Thanks for contributing to Recipe Jar! Keep PRs focused on one thing. -->

## What & why

<!-- What does this change, and why? Link the issue it closes, e.g. "Closes #123". -->

## How to test

<!-- Steps a reviewer can follow to see it working. For a new-site parser fix,
     mention the fixture you added. -->

## Checklist

- [ ] `npm run check` passes (types)
- [ ] `npm run test:unit` passes
- [ ] `npm run build && npm run size` is within budget
- [ ] `npx playwright test --project=chromium` passes
- [ ] Accessibility holds up (labels, focus, keyboard) — axe stays green
- [ ] No user data leaves the device; no new runtime dependency (or explained why)
- [ ] Docs/screenshots updated if behavior or UI changed

## Screenshots / clip

<!-- For UI changes, a before/after image or short clip helps a lot. -->
