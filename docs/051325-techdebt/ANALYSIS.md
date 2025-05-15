# IndieFindr Technical Debt Cleanup Plan

This document outlines a comprehensive plan to address technical debt, improve code quality, and establish better practices for future development iterations of IndieFindr. **Crucially, this cleanup is designed to lay the foundational groundwork necessary to achieve the ambitious goals set forth in the `PLATFORM_VISION.MD`, enabling a modular, data-rich, and scalable platform for indie game discovery.** The plan is organized into several focus areas, each with specific actions and their expected impact on both immediate code health and long-term platform capabilities.

## 1. Code Structure & Organization

### 1.1. Component Standardization

**Current Issues:**
- Inconsistent component file structure and organization
- Lack of clear patterns for component props and state management
- Large, monolithic components like `game-card.tsx` (>400 lines)

**Actions:**
- [ ] Create a standard component template structure with consistent patterns
- [ ] Break down large components like `game-card.tsx` into smaller, reusable sub-components **designed as "content atoms" capable of displaying diverse data types.**
- [ ] Establish clear folder organization for feature-based components vs. shared UI elements
- [ ] Add component documentation via JSDoc or similar

**Impact:** Improved maintainability, easier onboarding for team members, more reusable code. **Critically, this enables the creation of flexible, composable UIs capable of rendering diverse content for rich game profiles and dynamic, mixed-content feeds as envisioned in `PLATFORM_VISION.MD`.**

### 1.2. Route Organization

**Current Issues:**
- Inconsistent route structure with mixed naming conventions
- Route handlers distributed across different folders without clear organization

**Actions:**
- [ ] Standardize route naming conventions (kebab-case for folders, PascalCase for components)
- [ ] Organize route handlers by feature domain
- [ ] Create dedicated route layouts for shared page structures

**Impact:** Improved navigation through codebase, more predictable routing behavior. **This supports a clear structure for expanding the platform with new sections like detailed game profiles, user collections, and potential developer portals.**

## 2. Data Layer Improvements

**This section is paramount for realizing the "Game Intelligence Hub" and "Automated Ingestion & Enrichment Pipeline" described in `PLATFORM_VISION.MD`.**

### 2.1. Database Access Patterns

**Current Issues:**
- Direct DB queries in page components (e.g., `page.tsx`)
- Lack of abstraction for database operations
- No clear separation between data access and presentation layers

**Actions:**
- [ ] Create a data access layer (DAL) with a repository pattern, **designing it for extensibility to support diverse data models from various game platforms and enrichment sources.**
- [ ] Move all database queries from page components to dedicated service modules within the DAL.
- [ ] Implement proper error handling and type safety for database operations.
- [ ] Create standardized data fetching hooks or utilities that consume the DAL.

**Example implementation:**
```typescript
// src/lib/repositories/game-repository.ts
import { db } from "@/db";
import { gamesTable /*, potential_enriched_data_table */ } from "@/db/schema";
import { eq } from "drizzle-orm";

export const GameRepository = {
  async getById(id: string) {
    // Example: Querying base game data
    return db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.id, id))
      .limit(1)
      .then(results => results[0] || null);
  },
  // async getGameWithEnrichedData(id: string) {
  //   // Future: Join with enriched data tables
  // },
  // Other methods for fetching, creating, and updating game data,
  // including data from various enrichment sources.
}
```

**Impact:** Improved testability, reduced duplication, better separation of concerns. **Most importantly, this establishes a flexible and extensible DAL, crucial for: a) modular integration of new data sources (Steam, Itch.io, YouTube APIs, etc.), b) storing and managing complex enriched game data, and c) powering dynamic, data-rich views for game profiles and feeds.**

### 2.2. Type Safety Enhancements

**Current Issues:**
- Inconsistent use of TypeScript types
- Missing or incomplete type definitions for API responses and database models
- Unclear relationships between types in different parts of the application

**Actions:**
- [ ] Ensure consistent use of Drizzle-inferred types for database operations **and define clear types for enriched data models.**
- [ ] Create shared types directory for API contracts, request/response models, **and standardized structures for diverse content types (e.g., articles, videos, social posts).**
- [ ] Add zod schemas for runtime validation of external inputs **from various data sources and enrichment processes.**
- [ ] Enforce stricter TypeScript settings (e.g., `noImplicitAny`, `strictNullChecks`)

**Impact:** Fewer runtime errors, better IDE support, improved maintainability. **Ensures data integrity and reliability as we ingest, process, and display information from numerous, varied sources, which is vital for the "Rich, Evolving Game Intelligence" pillar.**

## 3. Performance & Resource Optimization

### 3.1. Rendering Optimization

**Current Issues:**
- Excessive Server Components that could be Client Components
- Lack of proper Suspense boundaries for asynchronous operations
- Inefficient data fetching patterns (multiple small requests)

**Actions:**
- [ ] Audit and optimize component rendering strategies (Server vs. Client)
- [ ] Implement proper Suspense boundaries for loading states
- [ ] Batch related data requests where possible
- [ ] Add proper caching strategies for frequently accessed data

**Impact:** Improved page load times, better user experience, reduced server load. **Essential for delivering a smooth and responsive experience when rendering data-intensive game profiles and dynamic mixed-content feeds.**

### 3.2. Image Optimization

**Current Issues:**
- Inconsistent image handling in `game-image.tsx` and other components
- Missing responsive image strategies
- No standardized approach to image optimization

**Actions:**
- [ ] Create standardized image component with proper sizing and optimization
- [ ] Implement responsive image sizes based on viewport
- [ ] Add proper image loading strategies (eager vs. lazy)
- [ ] Implement image format optimization (WebP, AVIF)

**Impact:** Better performance, reduced bandwidth usage, improved Core Web Vitals. **Key for showcasing diverse media (screenshots, art, video thumbnails) effectively within rich game profiles.**

## 4. State Management & Data Flow

### 4.1. Client-Side State Management

**Current Issues:**
- No clear strategy for client-side state management
- Prop drilling in component hierarchies
- Inconsistent patterns for user data access

**Actions:**
- [ ] Implement context providers for shared state (e.g., user profile, theme)
- [ ] Create custom hooks for common state management patterns
- [ ] Consider using React Query or SWR for server state management
- [ ] Document state management patterns for team alignment

**Impact:** Reduced prop drilling, clearer data flow, better state management. **Supports the "Hyper-Personalized Experience" by efficiently managing user-specific preferences, feed configurations, and interactions with complex data views.**

### 4.2. API Integration

**Current Issues:**
- Inconsistent API calling patterns
- Lack of standardized error handling
- Missing retry logic for transient failures

**Actions:**
- [ ] Create standardized API client with consistent error handling, **designed to be extensible for various internal services and external data providers (e.g., game storefront APIs, social media APIs, LLM services for enrichment).**
- [ ] Implement request/response interceptors for common operations (e.g., auth, logging, data transformation for specific sources).
- [ ] Add retry logic for network failures.
- [ ] Create typed API hooks for common operations.

**Example implementation:**
```typescript
// src/lib/api/client.ts
export const apiClient = {
  async get<T>(url: string, /* config?: RequestConfig */): Promise<T> { // Config could specify source type for adapter use
    try {
      const res = await fetch(url /*, adaptedHeadersIfNeeded */);
      if (!res.ok) {
        // Consider source-specific error handling
        throw new Error(`API error: ${res.status} from ${url}`);
      }
      return res.json(); // Consider data transformation/normalization here or in a dedicated layer
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error; // Or a more structured error object
    }
  },
  // async post<T>(url: string, data: any, /* config?: RequestConfig */): Promise<T> { ... }
  // Other methods...
  // Potentially:
  // steamApi.getGameDetails(appId)
  // enrichmentApi.fetchSocialMentions(gameName)
}
```

**Impact:** More reliable API interactions, better error handling, improved developer experience. **Fundamental for the "Automated Ingestion & Enrichment Pipeline" and for aggregating content from diverse sources for the "Discovery Engine" and "Game Intelligence Hub."**

## 5. Authentication & Security

### 5.1. Auth Flow Improvements

**Current Issues:**
- Auth logic scattered across components
- Inconsistent handling of authenticated vs. unauthenticated states
- No clear pattern for protected routes

**Actions:**
- [ ] Centralize auth logic in dedicated hooks and utilities
- [ ] Create standardized auth-aware components (e.g., `<RequireAuth>`)
- [ ] Implement consistent auth state handling across the application
- [ ] Add proper token refresh logic

**Impact:** Improved security, more consistent user experience, reduced duplication. **Provides a necessary foundation for personalized content, user collections, and community features outlined in `PLATFORM_VISION.MD`.**

### 5.2. Security Enhancements

**Current Issues:**
- Limited CSRF protection
- No consistent input validation
- Missing security headers

**Actions:**
- [ ] Implement proper CSRF protection for all forms and mutations
- [ ] Add zod validation for all user inputs
- [ ] Configure proper security headers (CSP, HSTS, etc.)
- [ ] Create security documentation and guidelines

**Impact:** Enhanced security posture, protection against common vulnerabilities

## 6. Testing & Quality Assurance

### 6.1. Testing Infrastructure

**Current Issues:**
- Limited or no automated testing
- No clear testing strategy
- Lack of CI/CD integration for tests

**Actions:**
- [ ] Set up Jest and React Testing Library
- [ ] Create testing utilities for common patterns
- [ ] Implement unit tests for critical utility functions
- [ ] Add component tests for key UI components
- [ ] Set up integration tests for critical user flows
- [ ] Configure GitHub Actions for automated testing

**Impact:** Higher code quality, faster feedback cycles, reduced regression risks

### 6.2. Error Handling & Monitoring

**Current Issues:**
- Inconsistent error handling patterns
- Limited error reporting
- No structured logging

**Actions:**
- [ ] Implement global error boundary components
- [ ] Create standardized error handling utilities
- [ ] Set up error tracking and monitoring (e.g., Sentry)
- [ ] Add structured logging for important events
- [ ] Create error reporting guidelines

**Impact:** Better visibility into application issues, faster resolution times

## 7. Developer Experience Improvements

### 7.1. Documentation

**Current Issues:**
- Limited code documentation
- Missing architecture diagrams
- Inconsistent commenting styles

**Actions:**
- [ ] Create a comprehensive README with setup instructions
- [ ] Document key architectural decisions
- [ ] Add JSDoc comments to critical functions and components
- [ ] Create architectural diagrams for key subsystems
- [ ] Document common workflows and patterns

**Impact:** Easier onboarding, better knowledge sharing, improved maintainability

### 7.2. Development Tooling

**Current Issues:**
- Limited linting and formatting rules
- No Git hooks for quality checks
- Inconsistent code styles

**Actions:**
- [ ] Configure ESLint with stricter rules
- [ ] Set up Prettier for consistent formatting
- [ ] Add pre-commit hooks for linting and formatting
- [ ] Configure VSCode settings for consistent developer experience
- [ ] Add npm scripts for common development tasks

**Impact:** More consistent code quality, reduced style debates, better commit quality

## 8. Refactoring Priorities

**These priorities are aligned with laying the critical groundwork for the `PLATFORM_VISION.MD`, focusing on data handling, UI composability, and core API interactions.**

### 8.1. High-Priority Refactors

1.  **DB Access Layer (DAL)**
    *   Create repositories for game, library, and profile data, **designing for future enriched data models and diverse source integration.**
    *   Move DB queries out of page components.
2.  **Component Structure for Composability**
    *   Break down `game-card.tsx` into smaller, **data-driven components suitable for varied content display.**
    *   Create standardized UI component library **focused on reusable "content atoms."**
3.  **Standardized API Client & Auth Flow**
    *   Centralize auth logic.
    *   Create consistent auth state management.
    *   **Develop an extensible API client for internal and external service communication.**

### 8.2. Medium-Priority Refactors

1.  **Refine API Structure (beyond initial client)**
    *   Implement robust error handling patterns across services.
    *   **Further develop patterns for data transformation/normalization from diverse API sources.**
2.  **Client-Side State Management Strategy**
    *   Implement context for shared global state (user, theme).
    *   Create custom hooks for common state patterns related to **managing personalized data and feed interactions.**

### 8.3. Lower-Priority Refactors

1. **Documentation**
   - Add JSDoc comments
   - Create architectural diagrams

2. **Performance Optimization**
   - Implement advanced caching strategies
   - Optimize image loading

## 9. Implementation Strategy

### 9.1. Phased Approach

**Phase 1 (Immediate Improvements)**
- Basic linting and formatting setup
- High-priority component refactoring
- DB access layer implementation

**Phase 2 (Core Architecture)**
- State management implementation
- API client standardization
- Auth flow improvements

**Phase 3 (Quality & Performance)**
- Testing infrastructure
- Performance optimizations
- Documentation improvements

### 9.2. Measurement & Validation

- Set up performance monitoring (Lighthouse, Web Vitals)
- Establish quality metrics (test coverage, linting errors)
- Create developer feedback loops for tooling and processes

## 10. Specific File Refactoring Plan

### Component Files

1. **`game-card.tsx` (414 lines)**
   - Split into `GameCardBase`, `GameCardMedia`, `GameCardMeta`, `GameCardActions`, **ensuring each can flexibly display different facets of basic and enriched game data.**
   - Extract shared logic to hooks.

2. **`feed.tsx` (192 lines)**
   - Move data fetching to dedicated repository/services via the DAL.
   - Create separate components for feed items and feed container, **designing feed items to be composable for various content types (game updates, articles, social posts, etc.).**

3. **`profile-mini-card.tsx` (168 lines)**
   - Extract profile data fetching to hooks/repository
   - Split into smaller subcomponents

### Logic Files

1. **`steam-enrichment.ts` (178 lines)**
   - Create clearer separation between API calling and data processing
   - Implement proper error handling and retry logic

2. **`embedding-generation.ts` (135 lines)**
   - Extract model-specific logic to separate files
   - Create clear interfaces between components

### App Files

1. **`page.tsx`**
   - Move data fetching to repositories/hooks
   - Implement proper loading states and error handling

2. **`layout.tsx`**
   - Optimize for proper caching and rendering strategy
   - Create clearer component boundaries

## 11. Conclusion

This technical debt cleanup plan provides a comprehensive roadmap for improving the codebase quality, maintainability, and performance of IndieFindr. **More significantly, it strategically directs refactoring efforts towards building a robust and flexible foundation, essential for realizing the ambitious `PLATFORM_VISION.MD`.** By implementing these changes methodically, the team can enhance the development experience while paving the way for advanced features like the Game Intelligence Hub, sophisticated enrichment pipelines, and a truly personalized discovery experience.

The plan should be treated as a living document, with regular updates based on new insights and changing requirements. Each completed item should be documented with the specific changes made and lessons learned, **particularly how they contribute to the long-term platform architecture.** 