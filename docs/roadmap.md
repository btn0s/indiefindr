# IndieFinder Roadmap

This document outlines the development roadmap for IndieFinder, focused on enhancing its mission as a premier platform for discovering indie games.

## 1. User Accounts & Personalization
- Implement user authentication with Next.js Auth
- Create user profile schema with preferences and game history
- Add Steam account linking API integration
- Develop recommendation engine using user's Steam library data
- Store play history and preferences to improve matching

## 2. Enhanced Game Data Collection
- Expand beyond Steam to include Itch.io API integration
- Add GOG, Epic, and other platform support
- Implement web scraping for official game sites to gather additional metadata
- Create a more robust metadata schema including:
  - Controller support information
  - Accessibility features
  - Development status (Early Access, Beta, etc.)
  - Update frequency data

## 3. Developer & Game Context
- Implement AI-powered web search to gather developer profiles
- Track funding sources (Kickstarter, publisher backing, etc.)
- Add YouTube API integration for dev diaries and gameplay videos
- Create developer activity metric (update frequency, community engagement)
- Record patch/update history to show ongoing development support

## 4. Improved Search & Discovery
- Add faceted search with multiple parameters
- Implement visual similarity search using the existing vector embeddings
- Create "games like this" feature using embedding similarity
- Add time-to-play estimates and session length data
- Develop mood/theme tagging beyond standard genre categories

## 5. Community Features
- Allow users to create and share curated lists
- Implement a review/rating system tied to user accounts
- Add the ability to follow specific developers or publishers
- Create notification system for game updates and releases
- Implement game recommendation sharing

## 6. Developer-Facing Features
- Create developer dashboard for claiming games
- Allow verified developers to add additional metadata
- Implement analytics for developers to see how users discover their games
- Add option for developers to highlight updates or announcements
- Create developer verification system

## 7. Technical Infrastructure
- Enhance the embedding system to include multi-modal data
- Improve caching strategy for faster page loads
- Implement periodic refreshing of game data
- Create a data pipeline for regular crawling of new/updated games
- Add webhook support for real-time updates from connected platforms 