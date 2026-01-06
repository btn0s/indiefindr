Rewrite the current branch's commit history onto a new branch with a clean, narrative-quality git commit history suitable for reviewer comprehension.

## Steps

### Validate the source branch

- Ensure the current branch has no merge conflicts, uncommitted changes, or other issues.
- Confirm it is up to date with main (or the target base branch).
- Verify the branch contains the work you want to rewrite.

### Analyze the changes

- Study all changes between the current branch and main.
- Form a clear understanding of the final intended state.
- Identify logical groupings of changes that should be separate commits.

### Create the clean branch

- Create a new branch named `{branch_name}-clean` from main (or the target base branch).
- This ensures a clean starting point without the messy history.

### Plan the commit storyline

- Break the implementation down into a sequence of self-contained steps.
- Each step should reflect a logical stage of development—as if writing a tutorial.
- Order commits to tell a coherent story of how the feature was built.
- Consider what a reviewer would need to understand at each step.

### Rewrite the history

- Apply the changes to the clean branch, committing step by step according to your plan.
- Use `git add` selectively to stage only the files/changes for each logical commit.
- Each commit must:
  - Introduce a single coherent idea.
  - Include a clear commit message and description.
  - Build logically on previous commits.
  - Add comments or inline GitHub comments when needed to explain intent.

### Verify correctness

- Confirm that the final state of `{branch_name}-clean` exactly matches the final state of the original branch.
- Use `git diff {original_branch}..{branch_name}-clean` to verify no differences.
- Use `--no-verify` only when necessary (e.g., to bypass known issues). Individual commits do not need to pass tests, but this should be rare.

### Open a pull request

- Create a PR from the clean branch to main.
- Write the PR following the instructions in pr.md.
- Include a link to the original branch for reference.

## Important Notes

- Never add yourself as an author or contributor on any branch or commit.
- Your commits should never include lines like:
  - `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
  - `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`
- There may be cases where you will need to push commits with `--no-verify` to avoid known issues. It is not necessary that every commit pass tests or checks, though this should be the exception. It is essential that the end state of your new branch be identical to the end state of the source branch.
- The goal is to create a clean, reviewable history—not to change the final implementation.
