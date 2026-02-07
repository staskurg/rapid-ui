---
name: Next.js GitHub Vercel Setup
overview: Set up a new Next.js project with App Router, initialize Git repository, configure GitHub connection, and prepare for Vercel deployment with personal accounts.
todos:
  - id: init-nextjs
    content: "Step 1: Initialize Next.js project in ai-admin-ui/ folder with TypeScript, App Router, Tailwind CSS, and ESLint. STOP: Test that app runs on localhost:3000"
    status: completed
  - id: setup-git
    content: "Step 2: Configure Git with user name and email, initialize repository. STOP: Verify Git config and initial commit"
    status: completed
  - id: github-setup
    content: "Step 3: Create private GitHub repository 'ai-admin-ui' and connect remote. STOP: Verify repo exists and is private, push initial commit"
    status: completed
  - id: create-structure
    content: "Step 4: Create folder structure per blueprint (components/admin, lib/spec, lib/ai, lib/inference, types, styles). STOP: Verify structure and commit"
    status: completed
  - id: install-deps
    content: "Step 5: Install core dependencies (shadcn/ui, TanStack Table, React Hook Form, Zod, OpenAI SDK). STOP: Verify install and build works"
    status: completed
  - id: setup-env
    content: "Step 6: Create .env.local and .env.example files. STOP: Verify .env.local is ignored and .env.example is tracked"
    status: completed
  - id: create-readme
    content: "Step 7: Create README.md with project description and setup instructions. STOP: Review and push to GitHub"
    status: completed
  - id: vercel-setup
    content: "Step 8: Connect GitHub repo to Vercel (project name: ai-admin-ui), configure env vars, deploy. STOP: Verify deployment works"
    status: completed
isProject: false
---

# Initial Setup Plan: Next.js + GitHub + Vercel

## Overview

Initialize a Next.js project with App Router, set up Git repository with GitHub integration, and configure Vercel deployment using personal accounts (GitHub: staskurg, email: [stas.kurg@gmail.com](mailto:stas.kurg@gmail.com), name: Stas Kurgansky).

**Project Details:**

- Repository name: `ai-admin-ui`
- Repository visibility: **Private**
- Project directory: `ai-admin-ui/` (subdirectory in Hackathon folder)
- Vercel project name: `ai-admin-ui` (same as GitHub repo)

## Setup Steps with Stopping Points

### Step 1: Initialize Next.js Project

- Create Next.js project in `ai-admin-ui/` subdirectory
- Use `create-next-app` with recommended settings:
  - TypeScript: Yes
  - ESLint: Yes
  - Tailwind CSS: Yes (required for shadcn/ui)
  - App Router: Yes
  - src/ directory: No (will follow blueprint structure)
  - Import alias: Yes (@/*)
- Project name: `ai-admin-ui`

**🛑 STOPPING POINT 1:** Test that Next.js project runs

- Navigate to `ai-admin-ui/` directory
- Run `npm run dev`
- Verify app loads at `http://localhost:3000`
- Check that TypeScript compilation works

---

### Step 2: Configure Git Repository

- Navigate to `ai-admin-ui/` directory
- Initialize Git repository (`git init`)
- Configure Git user:
  - `git config user.name "Stas Kurgansky"`
  - `git config user.email "stas.kurg@gmail.com"`
- Verify `.gitignore` exists (created by Next.js) and includes `.env.local`
- Make initial commit with Next.js boilerplate

**🛑 STOPPING POINT 2:** Verify Git setup

- Run `git status` to verify repository is initialized
- Run `git log` to verify initial commit exists
- Verify user config: `git config user.name` and `git config user.email`

---

### Step 3: Create GitHub Repository

- Create GitHub repository:
  - Repository name: `ai-admin-ui`
  - Owner: `staskurg`
  - Visibility: **Private**
  - Initialize with README: No (we'll create our own)
  - Add .gitignore: No (we already have one)
  - Choose license: None (or add later)
- Add remote origin: `git remote add origin https://github.com/staskurg/ai-admin-ui.git`
- Push initial commit to GitHub: `git push -u origin main` (or `master`)

**🛑 STOPPING POINT 3:** Verify GitHub connection

- Check repository exists at `https://github.com/staskurg/ai-admin-ui`
- Verify repository is private
- Verify initial commit appears on GitHub
- Run `git remote -v` to confirm remote URL

---

### Step 4: Project Structure Setup

Based on blueprint folder structure:

- Create directory structure:
  - `app/` (already exists with Next.js)
  - `components/admin/`
  - `lib/spec/`
  - `lib/ai/`
  - `lib/inference/`
  - `types/`
  - `styles/`
- Create placeholder files to establish structure (e.g., `.gitkeep` or minimal files)

**🛑 STOPPING POINT 4:** Verify folder structure

- Check all directories exist
- Verify Next.js still runs: `npm run dev`
- Commit structure: `git add .` and `git commit -m "Add project structure"`
- Push to GitHub: `git push`

---

### Step 5: Install Core Dependencies

Install packages from blueprint tech stack:

- UI: Initialize `shadcn/ui` (requires setup)
- Table: `@tanstack/react-table`
- Forms: `react-hook-form`
- Validation: `zod`
- AI: `openai` (for OpenAI SDK)
- Additional: `@hookform/resolvers` (for Zod integration)

**🛑 STOPPING POINT 5:** Verify dependencies install correctly

- Run `npm install` and verify no errors
- Check `package.json` has all dependencies
- Verify TypeScript still compiles: `npm run build`
- Commit dependency changes: `git add package.json package-lock.json` and `git commit -m "Add core dependencies"`

---

### Step 6: Environment Configuration

- Create `.env.local` file for environment variables
- Add placeholder for OpenAI API key: `OPENAI_API_KEY=`
- Verify `.gitignore` includes `.env.local` (should already be there)
- Create `.env.example` with template: `OPENAI_API_KEY=your_api_key_here`

**🛑 STOPPING POINT 6:** Verify environment setup

- Check `.env.local` exists and is in `.gitignore`
- Verify `.env.example` exists and is tracked by Git
- Test that `.env.local` is not committed: `git status` should not show it
- Commit `.env.example`: `git add .env.example` and `git commit -m "Add environment template"`

---

### Step 7: Create Documentation

- Create `README.md` with:
  - Project description
  - Setup instructions
  - Environment variables needed
  - Development commands
  - Link to blueprint document

**🛑 STOPPING POINT 7:** Verify documentation

- Review README.md content
- Commit documentation: `git add README.md` and `git commit -m "Add README"`
- Push to GitHub: `git push`
- Verify README appears on GitHub

---

### Step 8: Vercel Deployment Setup

- Verify project is ready for Vercel:
  - Build command: `next build` (default)
  - Output directory: `.next` (default)
  - Install command: `npm install` (default)
- Test build locally: `npm run build`
- Manual step: Connect GitHub repository to Vercel via dashboard
  - Go to Vercel dashboard
  - Import project from GitHub
  - Select `staskurg/ai-admin-ui` repository
  - Project name: `ai-admin-ui`
  - Framework preset: Next.js (should auto-detect)
  - Root directory: `./` (default)
- Configure environment variables in Vercel:
  - Add `OPENAI_API_KEY` (user will add value later)
- Deploy initial version

**🛑 STOPPING POINT 8:** Verify Vercel deployment

- Check deployment succeeds on Vercel dashboard
- Verify deployment URL is accessible
- Test that the deployed app loads correctly
- Verify environment variables are configured (even if empty)

## Files to Create/Modify

### New Files

- `ai-admin-ui/package.json` (via Next.js init)
- `ai-admin-ui/.gitignore`
- `ai-admin-ui/.env.local` (local only, not committed)
- `ai-admin-ui/.env.example`
- `ai-admin-ui/README.md`
- `ai-admin-ui/next.config.js` or `next.config.ts`
- `ai-admin-ui/tsconfig.json` (via Next.js init)
- `ai-admin-ui/tailwind.config.ts` (via Next.js init)
- `ai-admin-ui/postcss.config.js` (via Next.js init)
- Directory structure per blueprint in `ai-admin-ui/`

### Configuration

- Git user configuration (local)
- GitHub remote URL
- Vercel project settings (via dashboard)

## Questions to Clarify

1. **Repository name**: What should the GitHub repository be named? (suggest: `ai-admin-ui`)
2. **Repository visibility**: Private or Public?
3. **Project directory**: Should we create the Next.js project in the current `/Users/staskurgansky/Hackathon` directory, or create a subdirectory?
4. **Vercel project name**: What should the Vercel project be named? (usually matches repo name)

## Manual Steps Required

1. **GitHub**: Create private repository `ai-admin-ui` on GitHub (Step 3)
2. **Vercel**: Connect repository to Vercel via dashboard (Step 8)
3. **OpenAI API Key**: User will need to add their OpenAI API key to `.env.local` and Vercel environment variables (after setup is complete)

## Success Criteria

- ✅ Next.js project initialized with TypeScript and App Router
- ✅ Git repository initialized with correct user configuration
- ✅ GitHub repository created and connected
- ✅ Project structure matches blueprint
- ✅ Core dependencies installed
- ✅ Environment files configured
- ✅ README with setup instructions
- ✅ Ready for Vercel deployment (connection can be done manually)

