# Releasing & Publishing

This project ships via an automated GitHub Actions workflow
([`.github/workflows/release.yml`](../.github/workflows/release.yml)). Pushing a `v*` tag builds,
tests, packages the `.vsix`, attaches it to a GitHub Release, and — if registry tokens are configured
as secrets — publishes to the VS Code Marketplace and/or Open VSX.

## How to cut a release (fully automated)

1. Bump `"version"` in [`package.json`](../package.json) (follow [semver](https://semver.org/): patch
   for fixes, minor for features).
2. Commit, tag, and push the tag:

   ```bash
   # after bumping "version" in package.json:
   git commit -am "release: v0.1.1"
   git tag v0.1.1
   git push --tags
   ```

3. The **Release** workflow runs automatically and:
   - type-checks, lints, and runs the tests,
   - packages `hover-translator-<version>.vsix`,
   - creates/updates the GitHub Release for the tag and attaches the `.vsix`,
   - publishes to the Marketplace / Open VSX **only if** the matching secret exists (see below).

> The tag version must match `package.json`'s `version`. A version can only be published **once** —
> bump it for every release.

## Publishing to a public registry (when you're ready)

Both are optional. Without any tokens, the workflow still produces the GitHub Release `.vsix` and
skips the publish steps. Add the token as a repository secret
(**Settings → Secrets and variables → Actions → New repository secret**), then the next `v*` tag
publishes automatically.

### Open VSX (card-free — recommended)

Used by Cursor, VSCodium, Gitpod. Requires a free Eclipse Foundation account + the Open VSX Publisher
Agreement (no credit card).

1. Sign in at <https://open-vsx.org> with GitHub → **Settings → Access Tokens** → generate a token.
2. Sign the **Eclipse Foundation Open VSX Publisher Agreement** (linked from your Open VSX settings;
   use the same email as your GitHub account).
   - If Eclipse registration throws an `unexpected error (####s)`: try an **incognito window**, a
     **different email** (e.g. Gmail), or **retry later** — it's a transient server-side error.
3. Create the namespace once (locally): `npx ovsx create-namespace mohammad-taleb -p <token>`.
4. Add the token as repository secret **`OVSX_PAT`**.
5. Push a `v*` tag → auto-published to `https://open-vsx.org/extension/mohammad-taleb/hover-translator`.

### VS Code Marketplace

Requires an Azure DevOps organization, which the current signup gates behind a (free) Azure account —
creating it asks for a card to verify identity (it won't charge).

1. Create publisher **`mohammad-taleb`** at <https://marketplace.visualstudio.com/manage> (must match
   `package.json`'s `publisher`).
2. Create a Personal Access Token at <https://dev.azure.com> → **User settings → Personal access
   tokens** → Organization: **All accessible**, Scope: **Marketplace → Manage**.
3. Add the token as repository secret **`VSCE_PAT`**.
4. Push a `v*` tag → auto-published to the Marketplace.

## Manual / local publishing (without CI)

```bash
npx @vscode/vsce package                              # build the .vsix
npx @vscode/vsce publish -p <VSCE_PAT>                # VS Code Marketplace
npx ovsx publish hover-translator-<version>.vsix -p <OVSX_PAT>   # Open VSX
```
