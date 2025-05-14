# Game Repository Pattern

This document explains the Game Repository pattern implementation in the IndieFindr application.

## Overview

The Repository pattern is a design pattern that abstracts the data access layer from the rest of the application. It provides a clean API for data access and centralizes data access logic, making the codebase more maintainable and testable.

In our implementation, we've created a `GameRepository` interface that defines the contract for game data access, and a `DrizzleGameRepository` implementation that uses Drizzle ORM to interact with the database.

## Benefits

- **Centralized Data Access**: All game data access is now through a single interface, making it easier to understand and maintain.
- **Abstraction**: The repository abstracts away the details of how data is stored and retrieved.
- **Testability**: The repository pattern makes it easier to mock data access for testing.
- **Flexibility**: We can easily switch to different data sources or add caching without changing the consuming code.
- **Error Handling**: Consistent error handling across all data access operations.
- **Performance Monitoring**: Built-in performance monitoring for all data access operations.

## Usage

### Getting the Repository Instance

```typescript
import { getGameRepository } from "@/lib/repositories";

// Get the repository instance
const gameRepository = getGameRepository();
```

### Basic Operations

#### Get a Game by ID

```typescript
const game = await gameRepository.getById(123);
if (game) {
  console.log(`Found game: ${game.title}`);
} else {
  console.log("Game not found");
}
```

#### Search for Games

```typescript
const games = await gameRepository.search({
  query: "strategy",
  tags: ["indie", "strategy"],
  limit: 10,
  orderBy: "newest"
});

console.log(`Found ${games.length} games`);
```

#### Get Recent Games

```typescript
const recentGames = await gameRepository.getRecent(5);
console.log("Recent games:", recentGames.map(g => g.title));
```

#### Create a New Game

```typescript
const newGame = await gameRepository.create({
  title: "New Game",
  externalId: "ext123",
  steamAppid: "123456",
  platform: "steam",
  // ... other properties
});

console.log(`Created game with ID: ${newGame.id}`);
```

#### Update a Game

```typescript
const updatedGame = await gameRepository.update(123, {
  title: "Updated Title",
  descriptionShort: "New description"
});

if (updatedGame) {
  console.log(`Updated game: ${updatedGame.title}`);
} else {
  console.log("Game not found");
}
```

#### Delete a Game

```typescript
const deleted = await gameRepository.delete(123);
console.log(deleted ? "Game deleted" : "Game not found");
```

## Error Handling

All repository methods include proper error handling and will throw meaningful errors if something goes wrong. It's recommended to wrap repository calls in try/catch blocks:

```typescript
try {
  const game = await gameRepository.getById(123);
  // Process game
} catch (error) {
  console.error("Error fetching game:", error);
  // Handle error appropriately
}
```

## Performance Monitoring

The repository implementation includes performance monitoring for all operations. The execution time for each operation is logged at the debug level.

## Extending the Repository

To add new methods to the repository:

1. Add the method signature to the `GameRepository` interface in `game-repository.ts`
2. Implement the method in the `DrizzleGameRepository` class in `drizzle-game-repository.ts`
3. Add tests for the new method in `__tests__/drizzle-game-repository.test.ts`

## Future Improvements

- Add caching layer for frequently accessed data
- Implement more sophisticated search capabilities
- Add support for additional data sources beyond the database
- Enhance error handling with more specific error types
- Add more comprehensive logging and monitoring

