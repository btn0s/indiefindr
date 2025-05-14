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
  // Optimize for image-heavy game discovery platform
  images: {
    minimumCacheTTL: 31536000, // 1 year cache for game images
    domains: ['steamcdn-a.akamaihd.net', 'cdn.cloudflare.steamstatic.com'], // Allow Steam CDN images
  },
  // Selective experimental features that make sense for our use case
  experimental: {
    optimizeCss: true,      // Optimize CSS for faster page loads
    scrollRestoration: true, // Important for feed navigation
  }
}
```

### 8.2 Optimized Client Component Architecture

Design components with a clear separation of concerns for optimal performance:

```typescript
// src/components/game/organisms/GameCard.tsx
"use client"
export function GameCard({ game, onAction, imageIndex = 0 }: GameCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Track interactions for personalization
  const { trackInteraction } = usePersonalization();
  
  // Handle user interactions
  const handleAction = (action: GameAction) => {
    trackInteraction({ gameId: game.id, action });
    onAction?.(action, game.id);
  };
  
  return (
    <Card 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <GameCardMedia 
        media={game.media} 
        isHovered={isHovered}
        imageIndex={imageIndex} 
      />
      <GameCardContent game={game} />
      <GameCardActions game={game} onAction={handleAction} />
    </Card>
  );
}
```

### 8.3 Efficient Data Fetching Strategy

Implement optimized data fetching with SWR for responsive feeds and infinite scrolling:

```typescript
// src/hooks/useFeed.ts
export function useFeed(
  feedType: FeedType, 
  options: FeedOptions = {}
) {
  const { data, error, size, setSize, isValidating } = useSWR(
    () => feedKeys.getKey(feedType, options),
    (key) => getFeedPage(key, size),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute
    }
  );
  
  const items = useMemo(() => data ? data.flatMap(page => page.items) : [], [data]);
  const isLoadingInitialData = !data && !error;
  const isLoadingMore = isLoadingInitialData || (size > 0 && data && typeof data[size - 1] === "undefined");
  const isEmpty = data?.[0]?.items.length === 0;
  const isReachingEnd = isEmpty || (data && data[data.length - 1]?.hasMore === false);
  
  const loadMore = useCallback(() => {
    if (!isLoadingMore && !isReachingEnd) {
      setSize(size + 1);
    }
  }, [isLoadingMore, isReachingEnd, setSize, size]);
  
  return {
    items,
    error,
    isLoadingInitialData,
    isLoadingMore,
    isEmpty,
    isReachingEnd,
    loadMore,
    isRefreshing: isValidating && data && data.length === size,
  };
}
```

### 8.4 API Route Optimization

Create efficient API endpoints for feed and game data:

```typescript
// src/app/api/feed/route.ts
export const dynamic = "force-dynamic"; // Feed is inherently dynamic for personalization

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedType = searchParams.get("type") || "trending";
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  
  const userId = await getCurrentUserId();
  
  // For non-personalized feeds, we can cache based on common params
  const cacheKey = !userId && feedType !== "personalized" 
    ? `feed:${feedType}:${page}:${pageSize}`
    : null;
    
  const feedData = cacheKey
    ? await redis.get(cacheKey).then(data => data ? JSON.parse(data) : null)
    : null;
    
  if (feedData) {
    return Response.json(feedData);
  }
  
  // Fetch feed data based on type and user
  const data = await getFeedData(feedType, page, pageSize, userId);
  
  // Cache non-personalized feeds
  if (cacheKey) {
    await redis.set(cacheKey, JSON.stringify(data), "EX", 300); // 5 min cache
  }
  
  return Response.json(data);
}
```

### 8.5 Image Optimization Strategy

Implement advanced image loading for game cards:

```typescript
// src/components/game/atoms/GameImage.tsx
export function GameImage({ 
  game, 
  priority = false,
  imageIndex = 0, 
  variant = "card"
}: GameImageProps) {
  // Determine appropriate sizes based on variant
  const sizes = {
    card: { width: 300, height: 169, quality: 75 },
    thumbnail: { width: 80, height: 45, quality: 65 },
    detail: { width: 600, height: 338, quality: 85 },
  }[variant];
  
  return (
    <Image
      src={game.imageUrl}
      alt={`${game.title} cover image`}
      loading={imageIndex < 12 ? "eager" : "lazy"} // Eagerly load first screen of images
      decoding={priority ? "sync" : "async"}
      placeholder={game.blurDataUrl ? "blur" : undefined}
      blurDataURL={game.blurDataUrl}
      className="game-image"
      width={sizes.width}
      height={sizes.height}
      quality={sizes.quality}
    />
  );
}
```

### 8.6 Virtualization for Feed Performance

Implement windowing for long feeds with react-window or react-virtualized:

```typescript
// src/components/feed/VirtualizedFeed.tsx
"use client"
export function VirtualizedFeed({ 
  initialItems, 
  fetchMoreItems, 
  hasMore 
}: VirtualizedFeedProps) {
  // Only render visible items for better performance
  return (
    <InfiniteLoader
      isItemLoaded={index => index < initialItems.length}
      itemCount={hasMore ? initialItems.length + 1 : initialItems.length}
      loadMoreItems={fetchMoreItems}
    >
      {({ onItemsRendered, ref }) => (
        <WindowScroller>
          {({ height, scrollTop }) => (
            <VariableSizeList
              ref={ref}
              onItemsRendered={onItemsRendered}
              height={height || 800}
              width="100%"
              itemCount={initialItems.length}
              itemSize={index => {
                // Dynamic sizing based on content type
                const item = initialItems[index];
                return item.type === 'game' ? 350 : 200;
              }}
              itemData={initialItems}
              overscanCount={3}
              scrollTop={scrollTop}
            >
              {({ index, style, data }) => (
                <div style={style}>
                  <FeedItem item={data[index]} />
                </div>
              )}
            </VariableSizeList>
          )}
        </WindowScroller>
      )}
    </InfiniteLoader>
  );
}
```

### 8.7 Selective Hydration Strategy

Implement selective hydration to prioritize interactive elements:

```typescript
// src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<AppShell />}>
          {/* Core app UI loads first */}
          <AppHeader />
          
          {/* Main content area with selective hydration priority */}
          <main>
            {children}
          </main>
          
          {/* Lower priority UI elements */}
          <Suspense fallback={<FooterSkeleton />}>
            <AppFooter />
          </Suspense>
        </Suspense>
        
        {/* Analytics loads last */}
        <Analytics />
      </body>
    </html>
  );
}
```

### 8.8 Progressive Enhancement

Implement progressive enhancement for critical user actions:

```typescript
// src/components/game/molecules/GameActionBar.tsx
"use client"
export function GameActionBar({ game, onAction }: GameActionBarProps) {
  // Track which features are supported
  const supportsShareApi = typeof navigator !== 'undefined' && !!navigator.share;
  
  const handleShare = async () => {
    if (supportsShareApi) {
      try {
        await navigator.share({
          title: game.title,
          text: `Check out ${game.title} on IndieFindr`,
          url: `https://indiefindr.com/games/${game.slug}`
        });
        onAction('share_success', game.id);
      } catch (error) {
        // Fall back to copy link
        copyGameLink(game);
        onAction('share_fallback', game.id);
      }
    } else {
      // No share API support
      copyGameLink(game);
      onAction('share_copy', game.id);
    }
  };
  
  return (
    <div className="game-action-bar">
      <Button onClick={() => onAction('bookmark', game.id)}>
        <BookmarkIcon /> Save
      </Button>
      <Button onClick={handleShare}>
        <ShareIcon /> Share
      </Button>
    </div>
  );
}
```

## 9. Conclusion

This refactoring blueprint provides a comprehensive approach to transforming the IndieFindr codebase into a solid foundation for the ambitious platform vision. By focusing on modularity, flexibility, and rich data structures, we lay the groundwork for a sophisticated discovery platform that can evolve with user needs and the indie game ecosystem.

The proposed changes maintain the core functionality while creating extensible patterns that support future features like AI-powered recommendations, rich game profiles, and personalized user experiences. This approach balances immediate technical debt cleanup with strategic architecture decisions that enable long-term platform goals. 