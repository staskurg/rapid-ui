# Vercel Deployment Guide

This project is ready for deployment on Vercel. Follow these steps to deploy:

## Prerequisites

- Vercel account (sign up at https://vercel.com)
- GitHub repository connected to your Vercel account
- OpenAI API key

## Deployment Steps

### 1. Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository:
   - Select **"staskurg/ai-admin-ui"** from the list
   - If you don't see it, click **"Adjust GitHub App Permissions"** and grant access

### 2. Configure Project Settings

- **Project Name**: `ai-admin-ui` (or leave default)
- **Framework Preset**: Next.js (should auto-detect)
- **Root Directory**: `./` (default)
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

### 3. Add Environment Variables

In the **Environment Variables** section, add:

- **Key**: `OPENAI_API_KEY`
- **Value**: Your OpenAI API key (get it from https://platform.openai.com/api-keys)
- **Environment**: Production, Preview, and Development (select all)

### 4. Deploy

Click **"Deploy"** and wait for the deployment to complete.

### 5. Verify Deployment

Once deployed:
- Visit your deployment URL (e.g., `https://ai-admin-ui.vercel.app`)
- Verify the app loads correctly
- Check that environment variables are set (you can verify in Vercel dashboard → Settings → Environment Variables)

## Automatic Deployments

After initial setup:
- **Production**: Automatically deploys when you push to `main` branch
- **Preview**: Automatically creates preview deployments for pull requests

## Manual Deployment

You can also deploy manually using Vercel CLI:

```bash
npm i -g vercel
vercel
```

Follow the prompts to deploy.

## Troubleshooting

### Build Fails

- Check that all dependencies are in `package.json`
- Verify Node.js version (Vercel uses Node 18+ by default)
- Check build logs in Vercel dashboard

### Environment Variables Not Working

- Ensure `OPENAI_API_KEY` is set in Vercel dashboard
- Redeploy after adding environment variables
- Check that variable names match exactly (case-sensitive)

### Deployment URL Issues

- Check domain settings in Vercel dashboard
- Verify DNS settings if using custom domain
- Check deployment logs for errors

## Project Configuration

The project uses default Next.js settings which are compatible with Vercel:
- Build command: `next build`
- Output directory: `.next`
- Node.js version: 18.x (default)

No additional configuration files (`vercel.json`) are needed for standard Next.js deployment.
