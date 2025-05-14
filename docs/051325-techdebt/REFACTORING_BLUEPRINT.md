# IndieFindr Refactoring Blueprint: Building the Foundation for the Platform Vision

This blueprint outlines a strategic approach to refactoring the IndieFindr codebase, focusing specifically on creating the technical foundation needed to support the ambitious platform vision described in PLATFORM_VISION.MD.

## Strategic Goals of the Refactoring

The refactoring aims to transform the current codebase into a robust foundation for:

1. A sophisticated game discovery engine with AI-powered features
2. Rich, evolving game profiles with data from diverse sources
3. A hyper-personalized experience based on user preferences
4. A flexible, modular architecture that can evolve with the platform

## 1. Data Layer Architecture: Building the Intelligence Hub Foundation

### 1.1 Modular Repository Pattern

Create a robust Data Access Layer (DAL) that separates domain concerns and enables integration with multiple data sources.

```typescript
// src/lib/repositories/game-repository.ts
export const GameRepository = {
  async getById(id: string) { /* ... */ },
  async getWithEnrichedData(id: string) { /* ... */ },
  async search(query: string, filters: GameSearchFilters) { /* ... */ },
  async getFeatured() { /* ... */ },
  // Future methods for different data sources
}

// src/lib/repositories/enrichment-repository.ts
export const EnrichmentRepository = {
  async getMediaForGame(gameId: string) { /* ... */ },
  async getSocialMentionsForGame(gameId: string) { /* ... */ },
  async getCommunityContentForGame(gameId: string) { /* ... */ },
  // Methods for different enrichment sources
}
```

### 1.2 Flexible Schema Design

Refactor the database schema to support rich game data from multiple sources:

```typescript
// src/db/schema.ts - Extended schema example
export const gameEnrichmentTable = pgTable(
  "game_enrichment",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    gameId: bigint("game_id", { mode: "number" })
      .notNull()
      .references(() => externalSourceTable.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // e.g., "youtube", "twitter", "reddit"
    sourceType: text("source_type").notNull(), // e.g., "video", "post", "article"
    content: jsonb("content"), // Flexible JSON structure for different content types
    sentiment: numeric("sentiment"), // For sentiment analysis results
    relevance: numeric("relevance"), // For relevance scoring
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  }
);
```

### 1.3 Data Transformation Layer

Implement a service layer that transforms raw data from repositories into view models suitable for UI components:

```typescript
// src/services/game-service.ts
export const GameService = {
  async getGameProfile(id: string): Promise<GameProfileViewModel> {
    const baseData = await GameRepository.getById(id);
    const enrichedData = await EnrichmentRepository.getMediaForGame(id);
    const socialData = await EnrichmentRepository.getSocialMentionsForGame(id);
    
    return transformToGameProfile(baseData, enrichedData, socialData);
  }
};
```

## 2. UI Architecture: Composable Components for Rich Experiences

### 2.1 Atomic Component Design

Break down monolithic components like `game-card.tsx` into smaller, reusable components that follow atomic design principles:

```typescript
// src/components/game/atoms/GameBadge.tsx
// src/components/game/atoms/GameCoverImage.tsx
// src/components/game/molecules/GameMetaInfo.tsx
// src/components/game/molecules/GameActionBar.tsx
// src/components/game/organisms/GameCard.tsx
// src/components/game/organisms/GameDetailPanel.tsx
// src/components/game/templates/GameProfile.tsx
```

### 2.2 Content Renderer System

Create a flexible content rendering system that can handle diverse content types for game profiles and feeds:

```typescript
// src/components/content/ContentRenderer.tsx
interface ContentRendererProps {
  content: ContentItem;
  variant?: 'compact' | 'standard' | 'detailed';
}

export function ContentRenderer({ content, variant = 'standard' }: ContentRendererProps) {
  switch (content.type) {
    case 'game':
      return <GameContent content={content} variant={variant} />;
    case 'video':
      return <VideoContent content={content} variant={variant} />;
    case 'article':
      return <ArticleContent content={content} variant={variant} />;
    case 'social':
      return <SocialContent content={content} variant={variant} />;
    default:
      return <FallbackContent content={content} />;
  }
}
```

### 2.3 Dynamic Feed System

Implement a feed system that supports mixed content types and personalization:

```typescript
// src/components/feed/FeedContainer.tsx
interface FeedContainerProps {
  feedType: 'personalized' | 'recent' | 'trending' | 'curated';
  contentFilter?: ContentFilter;
}

export function FeedContainer({ feedType, contentFilter }: FeedContainerProps) {
  const { items, isLoading, error, loadMore } = useFeed(feedType, contentFilter);
  
  return (
    <div className="feed-container">
      {items.map((item) => (
        <FeedItem key={item.id} item={item} />
      ))}
      {/* Loading and error states */}
    </div>
  );
}
```

## 3. API & Integration Layer: Connecting the Ecosystem

### 3.1 Unified API Client

Create a flexible API client that can handle external APIs and internal services:

```typescript
// src/lib/api/client.ts
export const ApiClient = {
  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    // Implementation with error handling, retries, etc.
  },
  
  // Different source-specific clients
  steam: {
    getGameDetails(appId: string) { /* ... */ },
  },
  
  enrichment: {
    getYouTubeContent(gameTitle: string) { /* ... */ },
    getSocialMentions(gameId: string) { /* ... */ },
  }
};
```

### 3.2 Data Enrichment Pipeline

Design a modular pipeline for enriching game data:

```typescript
// src/services/enrichment-service.ts
export const EnrichmentService = {
  async enrichGame(gameId: string) {
    // Orchestrate the enrichment process
    await this.enrichBasicInfo(gameId);
    await this.enrichMedia(gameId);
    await this.enrichSocialMentions(gameId);
    await this.generateEmbeddings(gameId);
  },
  
  async enrichBasicInfo(gameId: string) { /* ... */ },
  async enrichMedia(gameId: string) { /* ... */ },
  async enrichSocialMentions(gameId: string) { /* ... */ },
  async generateEmbeddings(gameId: string) { /* ... */ },
};
```

## 4. State Management: Supporting Personalization

### 4.1 Context Structure

Expand the context system to support personalization and rich user experiences:

```typescript
// src/contexts/index.tsx
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LibraryProvider>
          <UserPreferencesProvider>
            <PersonalizationProvider>
              {children}
            </PersonalizationProvider>
          </UserPreferencesProvider>
        </LibraryProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
```

### 4.2 Personalization Hooks

Create hooks for accessing and managing personalized experiences:

```typescript
// src/hooks/usePersonalization.ts
export function usePersonalization() {
  const { preferences, feedSettings, updatePreferences } = useContext(PersonalizationContext);
  
  const getPersonalizedFeed = useCallback(() => {
    // Logic to fetch personalized feed based on user preferences
  }, [preferences]);
  
  return {
    preferences,
    feedSettings,
    updatePreferences,
    getPersonalizedFeed,
  };
}
```

## 5. Implementation Plan

### 5.1 Phase 1: Foundation (Weeks 1-3)

1. **Data Architecture**
   - Implement repository pattern
   - Create basic service layer
   - Refactor schema for enriched data

2. **Component Structure**
   - Break down `game-card.tsx` into atomic components
   - Create initial content renderer system

### 5.2 Phase 2: Core Features (Weeks 4-7)

1. **API Integration**
   - Implement unified API client
   - Create basic enrichment pipeline components
   - Add support for game metadata from external sources

2. **Feed System**
   - Implement dynamic feed container
   - Create content-specific renderers
   - Add basic personalization

### 5.3 Phase 3: Advanced Features (Weeks 8-10)

1. **Advanced Personalization**
   - Implement preference tracking
   - Create recommendation algorithms
   - Enhance content filtering

2. **Enhanced Game Profiles**
   - Add multi-source content display
   - Implement social content integration
   - Create interactive elements

## 6. Key Refactoring Targets

1. **Game-Card Component**
   - Split into atomic components
   - Make content-type agnostic
   - Support rich media variants

   ```typescript
   // Before: One monolithic 400+ line component
   // After: Multiple focused components
   export function GameCard({ game, ...props }) {
     return (
       <Card>
         <GameCardMedia media={game.media} />
         <GameCardContent game={game} />
         <GameCardActions game={game} />
       </Card>
     );
   }
   ```

2. **Feed Component**
   - Make content-type agnostic
   - Support personalization
   - Add mixed content handling

3. **Database Access**
   - Move from inline queries to repository pattern
   - Add caching strategies
   - Support multiple data sources

4. **API Integration**
   - Create unified client with adapters
   - Implement error handling and retry logic
   - Support authentication across services

## 7. Success Metrics

1. **Code Quality**
   - Reduced component size (no component over 200 lines)
   - Increased test coverage
   - Consistent patterns across codebase

2. **Performance**
   - Improved load times for game profiles
   - Reduced database query count
   - Better client-side caching

3. **Developer Experience**
   - Clearer code organization
   - Better documentation
   - Faster onboarding for new features

4. **Future Readiness**
   - Support for new content types without refactoring
   - Easy integration with new data sources
   - Scalable architecture for growing user base

## 8. Performance Optimization Strategy

### 8.1 Next.js Configuration Enhancements

```javascript
// next.config.ts
const nextConfig = {
  experimental: {
    ppr: true,              // Partial Prerendering for game profiles
    inlineCss: true,        // Reduce render-blocking CSS
    reactCompiler: true,    // Optimize React code compilation
  },
  images: {
    minimumCacheTTL: 31536000, // 1 year cache for game images
  }
}
```

### 8.2 Server Components Architecture

Convert current client components to server components where possible:

```typescript
// src/components/game/organisms/GameCard.tsx
// Before: "use client"
// After: Server Component by default
export async function GameCard({ gameId }: { gameId: string }) {
  const game = await GameRepository.getById(gameId);
  
  return (
    <Card>
      <Suspense fallback={<GameCardSkeleton />}>
        <GameCardMedia media={game.media} />
      </Suspense>
      <GameCardContent game={game} />
      <ClientSideActions gameId={gameId} /> {/* Keep interactive parts client-side */}
    </Card>
  );
}
```

### 8.3 Data Fetching and Caching Strategy

Implement sophisticated caching for game data:

```typescript
// src/lib/cache.ts
export const unstable_cache = <Inputs extends unknown[], Output>(
  callback: (...args: Inputs) => Promise<Output>,
  key: string[],
  options: { revalidate: number },
) => cache(next_unstable_cache(callback, key, options));

// src/repositories/game-repository.ts
export const getGameWithEnrichment = unstable_cache(
  async (gameId: string) => {
    const [baseData, enrichedData] = await Promise.all([
      db.query.games.findById(gameId),
      db.query.gameEnrichment.findByGameId(gameId)
    ]);
    return transformGameData(baseData, enrichedData);
  },
  ["game-enriched"],
  { revalidate: 3600 } // 1 hour
);
```

### 8.4 Image Optimization Pipeline

Enhance image loading strategy:

```typescript
// src/components/game/atoms/GameImage.tsx
export function GameImage({ 
  game, 
  priority = false,
  imageCount = 0 
}: GameImageProps) {
  return (
    <Image
      src={game.imageUrl}
      alt={`${game.title} cover art`}
      loading={imageCount < 15 ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      className="game-image"
      width={300}
      height={400}
      quality={75}
    />
  );
}
```

### 8.5 Feed Performance Optimization

Implement efficient feed loading:

```typescript
// src/app/feed/page.tsx
export default async function FeedPage() {
  return (
    <div>
      <Suspense fallback={<FeedSkeleton />}>
        {/* Static part loads instantly */}
        <FeedHeader />
        
        {/* Dynamic feed content streams in */}
        <Suspense fallback={<GameCardSkeleton count={4} />}>
          <FeedContent />
        </Suspense>
        
        {/* Delayed loading of less critical content */}
        <Suspense>
          <RecommendationsSidebar />
        </Suspense>
      </Suspense>
    </div>
  );
}
```

### 8.6 API Route Optimization

Optimize API endpoints for performance:

```typescript
// src/app/api/games/[id]/route.ts
export const dynamic = "force-dynamic"; // For real-time game data
export const revalidate = 3600; // 1 hour for static game data

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const gameData = await getGameWithEnrichment(params.id);
  
  return Response.json(gameData, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
    }
  });
}
```

### 8.7 Analytics and Monitoring

Implement performance monitoring:

```typescript
// src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <SpeedInsights />
      </head>
      <body>
        {children}
        <Analytics 
          endpoint="/api/analytics"
          sampleRate={0.1} // 10% of traffic
        />
      </body>
    </html>
  );
}
```

## 9. Conclusion

This refactoring blueprint provides a comprehensive approach to transforming the IndieFindr codebase into a solid foundation for the ambitious platform vision. By focusing on modularity, flexibility, and rich data structures, we lay the groundwork for a sophisticated discovery platform that can evolve with user needs and the indie game ecosystem.

The proposed changes maintain the core functionality while creating extensible patterns that support future features like AI-powered recommendations, rich game profiles, and personalized user experiences. This approach balances immediate technical debt cleanup with strategic architecture decisions that enable long-term platform goals. 