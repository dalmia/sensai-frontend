# Github Workflow

## Commit Triggers

- ONLY commit code when the user EXPLICITLY requests a commit with clear phrases like "commit this", "commit these changes", or "make a commit now"
- NEVER initiate the commit process based on general positive feedback or approval of the code itself
- Do NOT interpret phrases like "looks good", "that works", or "nice job" as commit triggers
- Always wait for a direct, unambiguous instruction to commit
- If unsure whether the user wants to commit, ASK EXPLICITLY before proceeding with any git commands

## GitHub CLI Commit Workflow

### 0. Confirm Commit Authorization

```bash
# ONLY proceed if the user has explicitly requested a commit
# NEVER assume authorization to commit based on positive feedback about the code
```

### 1. Stage Changes

```bash
# Stage all changes
git add .

# Or stage specific files if appropriate
git add [specific files]
```

### 2. Check Status Before Committing

```bash
# Verify what's being committed
git status
```

### 3. Write Commit Message

Follow the Conventional Commits format:

```bash
# For new features
git commit -m "feat: implement [specific feature name]"

# For bug fixes
git commit -m "fix: resolve [specific issue]"

# For documentation changes
git commit -m "docs: update documentation for [feature]"

# For refactoring
git commit -m "refactor: improve [component/function] structure"

# For performance improvements
git commit -m "perf: optimize [specific operation]"

# For tests
git commit -m "test: add tests for [feature]"

# For style changes (formatting, etc.)
git commit -m "style: format code in [files/components]"
```

### 4. Push Changes

```bash
# Push to the current branch
git push origin [branch-name]
```

### 5. Create Pull Request (if needed)

```bash
# Create a pull request using GitHub CLI
gh pr create --title "[Descriptive Title]" --body "[Detailed description of changes]"
```

## Best Practices

### Commit Content

- Each commit should address a single concern
- Include all related files in the same commit
- Ensure the code builds and passes tests before committing

### Commit Messages

- Start with a type (feat, fix, docs, style, refactor, perf, test, etc.)
- Use imperative mood ("add" not "added" or "adds")
- Keep the first line under 72 characters
- Add detailed description in the commit body if needed
- Include references to specific features that received positive feedback
- Document any non-obvious design decisions
- Note any configuration changes required

### After Committing

- Provide minimal confirmation that the commit was successful
- Do NOT provide lengthy summaries of what was committed
- Do NOT ask if any refinements are needed
- Do NOT suggest next steps
- Simply confirm the commit was completed and wait for further instructions
