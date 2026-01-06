Rewrite the current branch's commit history onto a new branch with a clean, narrative-quality git commit history suitable for reviewer comprehension.

## Steps

### Validate the source branch

- Ensure the current branch has no merge conflicts, uncommitted changes, or other issues.
- Confirm it is up to date with main (or the target base branch).
- Verify the branch contains the work you want to rewrite.

### Analyze the current state

- Study the entire codebase in its current state.
- Review the git history to understand what was built.
- Form a clear understanding of the final intended state.
- Identify logical groupings of functionality that should be separate commits.
- Consider the natural progression: setup → infrastructure → core features → enhancements → polish.

### Find the starting point

- Identify the initial commit or a suitable base commit (e.g., initial Next.js setup).
- This will be the foundation for the clean rewrite.
- Checkout this commit to start fresh: `git checkout <initial-commit-hash>`

### Create the clean branch

- Create a new branch named `{branch_name}-rewrite` (or `{branch_name}-clean`) from the initial commit.
- This ensures a completely clean starting point without any messy history.
- Example: `git checkout -b main-rewrite <initial-commit-hash>`

### Checkout all current files

- Get all files from the current branch: `git checkout {current-branch} -- .`
- This stages all current files so you can commit them in logical groups.
- Reset the staging area: `git reset` to unstage everything.

### Plan the commit storyline

- Break the implementation down into a sequence of self-contained steps.
- Each step should reflect a logical stage of development—as if writing a tutorial.
- Order commits to tell a coherent story of how the application was built.
- Consider what a reviewer would need to understand at each step.
- Typical progression:
  1. Project setup and configuration
  2. Database foundation (schema, types, clients)
  3. Core infrastructure (API integrations, utilities)
  4. Business logic (ingestion, AI features)
  5. API layer (routes and endpoints)
  6. UI components (design system, reusable components)
  7. Pages and views (home, detail pages)
  8. Database evolution (migrations in logical order)
  9. Features (collections, video, etc.)
  10. Performance optimizations
  11. SEO and metadata
  12. Polish and documentation

### Rewrite the history

- Apply the changes to the clean branch, committing step by step according to your plan.
- Use `git add` selectively to stage only the files/changes for each logical commit.
- Each commit must:
  - Introduce a single coherent idea.
  - Include a clear commit message with a summary line and bullet points describing what changed.
  - Build logically on previous commits.
  - Be self-contained and reviewable independently.
- Commit in logical groups:
  - Configuration files together (package.json, next.config.ts, etc.)
  - Database migrations in chronological/functional order
  - Related components together
  - Features as complete units
- Example commit structure:
  ```
  Short summary line (50 chars or less)

  - First bullet point describing what was added/changed
  - Second bullet point with more detail
  - Third bullet point if needed
  ```

### Handle edge cases

- If files exist in the initial commit but not in the current branch, remove them to match exactly.
- If binary files differ, ensure they match the target branch state.
- Check for any files that should be ignored but were accidentally committed.

### Verify correctness

- Confirm that the final state of `{branch_name}-rewrite` exactly matches the final state of the original branch.
- Use `git diff {original_branch}..{branch_name}-rewrite` to verify no differences.
- The output should be empty (or only show expected differences like commit hashes).
- Verify file counts match: `git ls-files | wc -l` on both branches.
- Use `--no-verify` only when necessary (e.g., to bypass known issues). Individual commits do not need to pass tests, but this should be rare.
- It is essential that the end state of your new branch be identical to the end state of the source branch.

### Push and create pull request

- Push the clean branch: `git push -u origin {branch_name}-rewrite`
- Create a PR from the clean branch to main (or target branch).
- Write a comprehensive PR description that:
  - Explains what was done (rewrote entire history)
  - Lists the logical commit groups/storyline
  - Highlights verification steps taken
  - Explains the benefits of the clean history
  - Includes a link to the original branch for reference
- The PR title should clearly indicate it's a history rewrite.

## Important Notes

- Never add yourself as an author or contributor on any branch or commit.
- Your commits should never include lines like:
  - `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
  - `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`
- The goal is to create a clean, reviewable history—not to change the final implementation.
- Each commit should be meaningful and tell part of the story.
- Group related changes together (e.g., all database migrations for a feature, all components for a page).
- Order commits logically: foundation first, then features, then optimizations and polish.

## Example Workflow

```bash
# 1. Validate current branch
git status
git log --oneline -10

# 2. Find initial commit
git log --reverse --oneline | head -1

# 3. Create clean branch from initial commit
git checkout <initial-commit-hash>
git checkout -b main-rewrite

# 4. Get all current files
git checkout main -- .

# 5. Reset staging area
git reset

# 6. Commit in logical groups
git add package.json next.config.ts components.json
git commit -m "Configure Next.js project with dependencies..."

git add src/lib/supabase/
git commit -m "Set up Supabase client and database types..."

# ... continue with logical commits ...

# 7. Verify final state matches
git diff main..main-rewrite

# 8. Push and create PR
git push -u origin main-rewrite
gh pr create --base main --head main-rewrite --title "..." --body "..."
```
