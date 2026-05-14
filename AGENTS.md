# Repository Instructions

## Development Operations

### Just

A `justfile` is available at the repository root with common build and test tasks. When working with this repository, use `just` to discover and run basic operations:

- `just check` - run linters, formatters, and tests

### Interacting with Git

Do not use `git add` or `git commit` unless the user explicitly asks you to. Let the user control when to stage and commit changes.

## Writing Style

All written output - documentation, ADRs, comments, commit messages - must follow these rules:

- **Plain technical UK English.**
- **No editorializing.** State what is true. Do not editorialize, speculate, or express opinions dressed as facts. Do not use phrases like "worth noting", "it is important to", "clearly", "obviously", "of course", "surprisingly", "interestingly", "this is a good fit", or similar. If something matters, state why it matters in concrete terms.
- **No weasel framing.** Avoid "appears to", "seems to", "looks like", "at the moment", "arguably", and similar hedges when a direct statement is possible. Use hedges only when genuinely uncertain, and state the source of uncertainty explicitly.
- **Plain typography.** Use plain ASCII punctuation. Do not use em dashes, en dashes, smart quotes, ellipses, or other Unicode punctuation. Use hyphens (-), straight quotes (""), and plain full stops instead.
