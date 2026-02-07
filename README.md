# AI-Native Developer Tool — Schema → Instant Admin UI

An AI-powered developer tool that transforms backend data structures into working internal admin interfaces instantly. Built for backend and full-stack engineers who need usable CRUD UIs without writing frontend code.

## Overview

Paste your backend data → instantly get a usable admin UI.

The tool demonstrates that AI can reason over backend structure and generate a constrained UI specification that renders into a real working interface.

## Features

- **Instant UI Generation**: Paste JSON payload or OpenAPI snippet to generate a complete admin interface
- **CRUD Operations**: Full create, read, update, delete functionality
- **Smart Field Detection**: Automatically detects field types and generates appropriate form controls
- **Filtering & Search**: Built-in filtering capabilities for data tables
- **Type-Safe**: Built with TypeScript and Zod validation

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **Table**: TanStack Table
- **Forms**: React Hook Form
- **Validation**: Zod
- **AI**: OpenAI SDK
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone git@github.com-personal:staskurg/ai-admin-ui.git
cd ai-admin-ui
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Add your OpenAI API key to `.env.local`:
```
OPENAI_API_KEY=your_api_key_here
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Build for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Project Structure

```
ai-admin-ui/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   └── page.tsx           # Main page
├── components/
│   └── admin/             # Admin UI components
├── lib/
│   ├── ai/                # AI integration
│   ├── inference/         # Data inference logic
│   └── spec/              # UI spec handling
├── types/                 # TypeScript type definitions
└── styles/                # Additional styles
```

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key (required)

## Deployment

This project is configured for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Add the `OPENAI_API_KEY` environment variable in Vercel dashboard
3. Deploy automatically on push to main branch

## Documentation

For detailed implementation plans and architecture, see:
- [Full Blueprint](./.cursor/ai_admin_ui_full_blueprint.md)

## License

Private project - All rights reserved
