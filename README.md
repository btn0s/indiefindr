# IndieFinder

IndieFinder is a platform dedicated to helping players discover amazing indie games. Our mission is to create the best resource for finding and exploring indie titles based on your preferences, while also providing a valuable platform for indie developers to showcase their work.

## Features

- **Smart Game Discovery**: Find indie games using semantic search and AI-powered recommendations
- **Detailed Game Profiles**: Get comprehensive information about games including descriptions, developer details, and community sentiment
- **Visual Recognition**: Our system analyzes game screenshots to help match visual styles you might enjoy
- **Steam Integration**: Currently supports importing and analyzing games from Steam

## Roadmap

We have an ambitious roadmap planned for IndieFinder! Check out [our roadmap](docs/roadmap.md) for upcoming features, including:

- User accounts with Steam linking
- Support for additional platforms (Itch.io, GOG, Epic)
- Developer profiles and verification
- Enhanced search and discovery tools
- Community features and curation
- And much more!

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: PostgreSQL with Drizzle ORM
- **AI/ML**: OpenAI embeddings for semantic search
- **API Integrations**: Steam API (with more platforms coming)

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL with pgvector extension
- OpenAI API key

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/indiefindr.git
   cd indiefindr
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Set up environment variables
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys and database connection
   ```

4. Run database migrations
   ```bash
   pnpm db:migrate
   ```

5. Start the development server
   ```bash
   pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) to see the app

## Contributing

We welcome contributions to IndieFinder! Whether it's adding new features, fixing bugs, or improving documentation, please feel free to make a pull request.

See our [contribution guidelines](CONTRIBUTING.md) for more information.

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](LICENSE) file for details. This license ensures that anyone who uses or modifies IndieFinder must also make their code available under the same terms, even when the software is accessed over a network.

## Acknowledgments

- Thanks to all the indie developers creating amazing games
- Built with Next.js and powered by Vercel
