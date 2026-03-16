# Contributing to Prism

## Getting Started

1. Fork the repository and clone your fork
2. Copy `.env.example` to `.env` and configure your environment
3. Run `docker-compose up -d` to start all services
4. Run `npm install` for local development

## Development Workflow

1. Create a feature branch from `master`
2. Make your changes following the conventions below
3. Run the quality checks (see below)
4. Submit a pull request

## Quality Standards

All pull requests must meet the following Lighthouse score thresholds:

**Dashboard pages** (`/`, `/d/[slug]`):

| Category | Minimum Score |
|---|---|
| Performance | 80% |
| Accessibility | 90% |
| Best Practices | 90% |
| SEO | 90% |

**Subpages** (all other routes):

| Category | Minimum Score |
|---|---|
| Performance | 90% |
| Accessibility | 95% |
| Best Practices | 95% |
| SEO | 95% |

The dashboard has lower performance thresholds because it loads 8+ real-time data sources on mount. The Next.js framework hydration cost (~700ms TBT) is structural and cannot be eliminated without switching to a streaming SSR architecture.

### Running Lighthouse

```bash
# Build and start the app
docker-compose up -d

# Run Lighthouse via Chrome DevTools or CLI
npx lighthouse http://localhost:3000 --output=json --output=html
```

### Other Checks

```bash
# TypeScript type checking
npx tsc --noEmit

# Linting
npx next lint

# Unit tests
npx jest

# E2E tests
npx playwright test
```

## Code Conventions

- **TypeScript**: Strict mode, no `any` unless unavoidable
- **Styling**: Tailwind CSS only — no inline styles or CSS modules
- **Components**: Keep under 250 lines; extract hooks or sub-components if larger
- **API Routes**: Use `withAuth` middleware, add Redis cache invalidation on mutations
- **Accessibility**: All interactive elements need accessible names; maintain WCAG 2.1 AA contrast ratios
- **Touch targets**: Minimum 44px (Apple HIG)

## Commit Messages

Write descriptive commit messages that explain the "why" rather than the "what".
