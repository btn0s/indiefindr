/**
 * Generate a secure random readable username using real words
 * Format: wordWORD123 (e.g., "underdogCAPTAIN321")
 * 
 * Uses cryptographically secure random number generation for security
 * Works on both server (Node.js) and client (browser)
 */
export function generateRandomUsername(): string {
  // Common adjectives and nouns that work well as usernames
  const adjectives = [
    "brave", "swift", "bold", "clever", "bright", "calm", "cool", "daring",
    "eager", "fierce", "gentle", "happy", "jolly", "keen", "lively", "mighty",
    "noble", "proud", "quick", "rapid", "sharp", "smart", "swift", "tough",
    "vivid", "witty", "zesty", "bold", "calm", "cool", "daring", "eager"
  ];

  const nouns = [
    "hero", "warrior", "captain", "knight", "ranger", "wizard", "rogue",
    "guardian", "champion", "explorer", "pilot", "scout", "hunter", "soldier",
    "ninja", "samurai", "viking", "pirate", "dragon", "phoenix", "tiger",
    "wolf", "eagle", "hawk", "lion", "bear", "fox", "raven", "falcon", "shark"
  ];

  // Use secure random number generation (works on both server and client)
  const getSecureRandomInt = (max: number): number => {
    // Check if we're in a browser environment
    if (typeof window !== "undefined" && typeof crypto !== "undefined" && crypto.getRandomValues) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return array[0] % max;
    }
    // Node.js server environment - use crypto module
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeCrypto = require("crypto");
      return nodeCrypto.randomInt(0, max);
    } catch {
      // Fallback to Math.random if crypto is unavailable (shouldn't happen in production)
      return Math.floor(Math.random() * max);
    }
  };

  // Pick random adjective and noun
  const adjective = adjectives[getSecureRandomInt(adjectives.length)];
  const noun = nouns[getSecureRandomInt(nouns.length)];

  // Convert noun to uppercase for variety (e.g., "CAPTAIN")
  const nounUpper = noun.toUpperCase();

  // Generate random 3-digit number
  const number = getSecureRandomInt(900) + 100; // 100-999

  // Combine: adjective + NOUN + number (e.g., "underdogCAPTAIN321")
  return `${adjective}${nounUpper}${number}`;
}
