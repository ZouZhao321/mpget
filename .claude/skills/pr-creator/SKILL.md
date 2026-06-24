---
name: pr-creator
description: Use this skill when asked to create a pull request (PR). It ensures all PRs
  follow the repository's established templates and standards.
---

# Pull Request Creator

This skill guides the creation of high-quality Pull Requests that adhere to the
repository's standards.

## Workflow

Follow these steps to create a Pull Request:

1.  **Branch Management**: **CRITICAL:** Ensure you are NOT working on the
    `main` branch.
    - Run `git branch --show-current`.
    - If the current branch is `main`, you MUST create and switch to a new
      descriptive branch:
      ```bash
      git checkout -b <new-branch-name>
      ```

2.  **Commit Changes**: Verify that all intended changes are committed.
    - Run `git status` to check for unstaged or uncommitted changes.
    - If there are uncommitted changes, stage and commit them with a descriptive
      message before proceeding. NEVER commit directly to `main`.
      ```bash
      git add .
      git commit -m "type(scope): description"
      ```

3.  **Detect Platform & Locate Template**: Determine remote platform (GitHub
    vs Gitea) and find PR template. Detect by checking which platform directory
    exists with PR templates, not by remote URL (self-hosted Gitea often uses IP
    addresses).
    - Check for platform-specific template directories:
      ```bash
      # Check for GitHub templates
      if ls .github/pull_request_template.md .github/PULL_REQUEST_TEMPLATE.md 2>/dev/null | grep -q .; then
        PLATFORM=github
        CLI=gh
      # Check for Gitea templates
      elif ls .gitea/pull_request_template.md .gitea/PULL_REQUEST_TEMPLATE.md 2>/dev/null | grep -q .; then
        PLATFORM=gitea
        CLI=tea
      else
        echo "Error: No PR template found (.github/ or .gitea/). Cannot proceed."
        exit 1
      fi
      ```
    - If multiple templates exist in subdirectory (e.g.,
      `.github/PULL_REQUEST_TEMPLATE/` or `.gitea/PULL_REQUEST_TEMPLATE/`), ask
      user which one to use or select most appropriate based on context (e.g.,
      `bug_fix.md` vs `feature.md`).

4.  **Read Template**: Read the content of the identified template file.

5.  **Draft Description**: Create a PR description that strictly follows the
    template's structure.
    - **Headings**: Keep all headings from the template.
    - **Checklists**: Review each item. Mark with `[x]` if completed. If an item
      is not applicable, leave it unchecked or mark as `[ ]` (depending on the
      template's instructions) or remove it if the template allows flexibility
      (but prefer keeping it unchecked for transparency).
    - **Content**: Fill in the sections with clear, concise summaries of your
      changes.
    - **Related Issues**: Link any issues fixed or related to this PR (e.g.,
      "Fixes #123").

6.  **Preflight Check**: Before creating the PR, run the workspace preflight
    script to ensure all build, lint, and test checks pass.

    ```bash
    npm run preflight
    ```

    If any checks fail, address the issues before proceeding to create the PR.

7.  **Push Branch**: Push the current branch to the remote repository.
    **CRITICAL SAFETY RAIL:** Double-check your branch name before pushing.
    NEVER push if the current branch is `main`.

    ```bash
    # Verify current branch is NOT main
    git branch --show-current
    # Push non-interactively
    git push -u origin HEAD
    ```

8.  **Create PR**: Use the detected CLI (`gh` for GitHub, `tea` for Gitea) to
    create the PR. To avoid shell escaping issues with multi-line Markdown, write
    the description to a temporary file first.

    ```bash
    # 1. Write drafted description to temp file
    TEMP_FILE=$(mktemp)
    cat > "$TEMP_FILE" << 'EOF'
    # paste drafted description here
    EOF
    # 2. Create PR using detected CLI
    case "$CLI" in
      gh)  gh pr create --title "type(scope): succinct description" --body-file "$TEMP_FILE" ;;
      tea) tea pr create --title "type(scope): succinct description" --body-file "$TEMP_FILE" ;;
    esac
    # 3. Remove temp file
    rm "$TEMP_FILE"
    ```

    - **Title**: Ensure the title follows the
      [Conventional Commits](https://www.conventionalcommits.org/) format if the
      repository uses it (e.g., `feat(ui): add new button`,
      `fix(core): resolve crash`).

## Principles

- **Safety First**: NEVER push to `main`. This is your highest priority.
- **Compliance**: Never ignore the PR template. It exists for a reason.
- **Completeness**: Fill out all relevant sections.
- **Accuracy**: Don't check boxes for tasks you haven't done.
