# Contributing to IndieFindr

Thank you for your interest in contributing to IndieFindr! This document will help you get started.

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- A Supabase project (free tier works fine)
- API keys for OpenAI and Perplexity

### Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/your-username/indiefindr.git
cd indiefindr
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

4. **Set up the database**

Apply migrations using the Supabase CLI:

```bash
supabase db push
```

Or manually apply migration files in order from `supabase/migrations/`.

5. **Run the development server**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

### Active Code

- `src/` - Production code
  - `app/` - Next.js app router pages and API routes
  - `components/` - React components
  - `lib/` - Core logic
    - `suggest.ts` - Main recommendation system (multi-strategy consensus)
    - `actions/` - Server actions
    - `supabase/` - Database clients
    - `utils/` - Utilities
  - `hooks/` - React hooks

### Research & Experiments

- `scripts/experiments-v2/` - Research experiments comparing different approaches
  - **Test A (Baseline)** is the current production system
  - Tests B, C, D are alternatives that were evaluated but not used
  - See `scripts/experiments-v2/README.md` for details

### Historical Archives

- `archive/vibe-experiments/` - Earlier experimental approaches (archived)
- `archive/suggestion-experiments/` - Alternative suggestion strategies (archived)

## Code Style

This project follows these conventions:

- **TypeScript**: Strict mode, avoid `any` types
- **React**: Prefer Server Components, avoid `useEffect` unless needed
- **Tailwind**: Use built-in values, compose smaller components
- **Next.js**: Prefer fetching in RSC, use `next/font` and `next/script` when applicable

See `.cursor/rules/leerob.mdc` for detailed style guidelines (if available).

## Submitting Changes

1. **Create a feature branch**

```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes**

Write clear, focused commits. Follow existing code style.

3. **Test your changes**

```bash
pnpm build  # Ensure it builds
pnpm lint   # Check for linting errors
```

4. **Push and create a Pull Request**

```bash
git push origin feature/your-feature-name
```

Then open a PR on GitHub with a clear description of what changed and why.

## Areas for Contribution

We welcome contributions in these areas:

- **UI/UX improvements** - Better game cards, navigation, search
- **Performance optimizations** - Faster suggestion generation, better caching
- **Additional game data sources** - More metadata, better Steam integration
- **Better recommendation algorithms** - Improved matching, new strategies
- **Bug fixes** - Fix issues, improve error handling
- **Documentation** - Improve docs, add examples, clarify setup

## Questions?

Open an issue on GitHub for questions or discussions. We're happy to help!
