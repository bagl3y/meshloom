# Contributing

## Guiding Principles

- In all your interactions with developers, maintainers, and users, be kind.
- Prefer small, comprehensible changes over large sweeping ones. Individual commits should be meaningful atomic chunks of work. Pull requests with many, many commits instead of a phased approach may be declined.
- Pull requests must be fully understood and explicitly endorsed by a human before merge. AI assistance is great, and this repo is optimized for it, but we keep quality by keeping our agents on track to write clear code, useful (not useless) tests, good architecture, and big-picture thinking.
- No pull request should introduce new failing lint, typecheck, test, or build results.
- Every pull request should have an associated issue or discussion thread; a brand new feature appearing first in a PR is an antipattern.
- No truly automated radio traffic. Bot replies are already the practical edge of what this project wants to automate; any kind of traffic that would be intervalized or automated is not what this project is about.
- No ingestion from the internet onto the mesh. This project is a radio client, not a bridge for outside traffic to enter the network. The mesh is strong because it is a radio mesh, not the internet with some weird wireless links.

## Local Development

### Backend

```bash
uv sync
uv run uvicorn app.main:app --reload
```

With an explicit serial port:

```bash
MESHCORE_SERIAL_PORT=/dev/ttyUSB0 uv run uvicorn app.main:app --reload
```

On Windows (PowerShell):

```powershell
uv sync
$env:MESHCORE_SERIAL_PORT="COM8"
uv run uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Run both the backend and `npm run dev` for hot-reloading frontend development.

## Quality Checks

Run the full quality suite before proposing or handing off code changes:

```bash
./scripts/quality/all_quality.sh
```

That runs linting, formatting, type checking, tests, and builds for both backend and frontend.

If you need targeted commands while iterating:

```bash
# backend
uv run ruff check app/ tests/ --fix
uv run ruff format app/ tests/
uv run pyright app/
PYTHONPATH=. uv run pytest tests/ -v

# frontend
cd frontend
npm run lint:fix
npm run format
npm run test:run
npm run build
```

## E2E Testing

E2E coverage exists, but it is intentionally not part of the normal development path.

These tests are only guaranteed to run correctly in a narrow subset of environments; they require a busy mesh with messages arriving constantly, an available autodetect-able radio, and a contact in the test database (which you can provide in `tests/e2e/.tmp/e2e-test.db` after an initial run). E2E tests are generally not necessary to run for normal development work.

```bash
cd tests/e2e
npm install
npx playwright test # headless
npx playwright test --headed # you can probably guess
```

## Pull Request Expectations

- Keep scope tight.
- Explain why the change is needed.
- Link the issue or discussion where the behavior was agreed on.
- Call out any follow-up work left intentionally undone.
- Do not treat code review as the place where the app's direction is first introduced or debated

## Notes For Agent-Assisted Work

Before making non-trivial changes, read:

- `./AGENTS.md`
- `./app/AGENTS.md`
- `./frontend/AGENTS.md`

Read these only when working in those areas:

- `./app/fanout/AGENTS_fanout.md`
- `./frontend/src/components/visualizer/AGENTS_packet_visualizer.md`

- Agent output is welcome, but human review is mandatory.
- Agents should start with the AGENTS files above before making architectural changes.
- If a change touches advanced areas like fanout or the visualizer, read the area-specific AGENTS file before editing.
