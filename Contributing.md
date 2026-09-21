# Contributing to ObjectLab

Thanks for helping improve ObjectLab, an educational Java OOP visualizer.

## Getting started

ObjectLab is a dependency-free browser application. Clone the repository and open `index.html` directly, or serve the project locally:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000` in a browser.

## Making changes

1. Create a focused branch for your change.
2. Keep the project dependency-free unless a dependency is clearly necessary.
3. Preserve the visualizer's educational focus and existing browser behavior.
4. Add or update regression tests for interpreter behavior in `tests/interpreter.test.js`.
5. Update `README.md` or `API.md` when changing supported syntax, limits, usage, or the public API.

Use the existing code style and keep changes small and easy to review. For new interpreter features, include cases for normal behavior and unsupported or invalid input where appropriate.

## Testing

Run the regression suite with Node.js:

```powershell
node --test tests/interpreter.test.js
```

Also manually open the application and verify the relevant visualization, timeline, heap/stack state, and console output. Check the browser console for errors.

## Pull requests

Explain what changed and why, and include the tests you ran. If the change affects the UI, include a screenshot or short description of the relevant interaction. Keep unrelated formatting or refactoring out of the pull request.

Before submitting, confirm that tests pass and that unsupported Java syntax still produces a clear source-line error instead of being silently ignored.

## Reporting issues

When reporting a bug, include a minimal Java example that reproduces it, the expected and actual behavior, steps to reproduce, and your browser/Node.js version when relevant.
