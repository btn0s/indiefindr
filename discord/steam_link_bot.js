import { Client, GatewayIntentBits, Events, Collection, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

// Configure logging
const logger = {
  info: (message) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`),
  error: (message) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`),
  debug: (message) => process.env.NODE_ENV === 'development' ? console.debug(`[DEBUG] ${new Date().toISOString()}: ${message}`) : null,
};

// Load environment variables from .env file
dotenv.config();


// Get configuration from environment variables
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:3000/api/find'; // Default if not set
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // Optional: For registering commands instantly to one guild

if (!DISCORD_BOT_TOKEN) {
  logger.error('Error: DISCORD_BOT_TOKEN environment variable not set.');
  process.exit(1);
}
if (!CLIENT_ID) {
  logger.error('Error: DISCORD_CLIENT_ID environment variable not set (needed for command registration).');
  process.exit(1);
}

// Define intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Keep this for the original functionality
  ],
});

// Command Handling (New)
client.commands = new Collection();
// We'll define commands in separate files later or add simple ones here
// For now, let's add a simple ping command handler directly

// Regex to find Steam store links and extract app ID
const steamLinkRegex = /https?:\/\/store\.steampowered\.com\/app\/(\d+)/g; // Added 'g' flag for global search

client.once(Events.ClientReady, (readyClient) => {
  logger.info(`Logged in as ${readyClient.user.tag} (ID: ${readyClient.user.id})`);
  logger.info('------');
});

client.on(Events.MessageCreate, async (message) => {
  // Ignore messages sent by the bot itself or messages without content
  if (message.author.bot) {
    logger.debug(`Ignoring message from bot: ${message.author.tag}`);
    return;
  }
  if (!message.content) {
    logger.debug(`Ignoring empty message from: ${message.author.tag}`);
    return;
  }

  logger.debug(`Received message from ${message.author.tag}: ${message.content}`);

  // Find all Steam links in the message using matchAll for global regex
  const matches = [...message.content.matchAll(steamLinkRegex)]; // Convert iterator to array to check length
  const appIdsFound = new Set(); // Use a set to avoid duplicate posts for the same ID in one message

  if (matches.length === 0) {
    logger.debug(`No Steam links found in message from ${message.author.tag}`);
    return; // No links found, no need to proceed further
  }

  for (const match of matches) {
    // const appId = match[1]; // Group 1 contains the app ID - No longer primary focus
    const fullLink = match[0]; // Group 0 contains the full matched link

    // Use the full link as the key to check if we've already processed it
    if (fullLink && !appIdsFound.has(fullLink)) { // Check/add the full link to the set
      appIdsFound.add(fullLink);
      // Extract app ID just for logging if needed, but use fullLink for payload
      const appId = match[1];
      logger.info(`Found Steam Link: ${fullLink} (App ID: ${appId}) in message from ${message.author.tag}`);

      // Prepare data for the API request with the full link
      const payload = { steam_link: fullLink }; // Send the full link
      logger.debug(`Preparing to send payload: ${JSON.stringify(payload)} to ${API_ENDPOINT}`);

      try {
        // Make POST request to the API endpoint using fetch
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
           // Throw an error for bad status codes (4xx or 5xx)
           const errorData = await response.text();
           throw new Error(`HTTP error! Status: ${response.status}, Body: ${errorData}`);
        }

        logger.info(`Successfully posted data (${Object.keys(payload).join('=...')}) to ${API_ENDPOINT}. Status: ${response.status}`);

        // --- Add Reply Logic --- 
        try {
          const responseData = await response.json();
          const findId = responseData.findId;

          if (findId) {
            const findUrl = `https://indiefindr.gg/find/${findId}`;
            const replyMessage = `Nice find! Check it out here: ${findUrl}`;
            await message.reply(replyMessage);
            logger.info(`Replied to message ${message.id} with find link: ${findUrl}`);
          } else {
            logger.warn(`API response for ${fullLink} did not include a findId. Cannot reply.`);
          }
        } catch (replyError) {
          logger.error(`Error processing API response or sending reply for message ${message.id}: ${replyError}`);
        }
        // --- End Reply Logic ---

      } catch (error) {
        // Construct error message using the payload keys
        const linkOrIdForLog = payload.steam_link || payload.app_id || 'unknown identifier'; 
        let errorMessage = `Failed to post data (${Object.keys(payload).join('=...')}) to ${API_ENDPOINT}. Link/ID: ${linkOrIdForLog}.`;
        // Updated error handling for fetch
        if (error instanceof Error) {
          errorMessage += ` Error: ${error.message}`;
        } else {
            errorMessage += ` Unknown error: ${error}`
        }
        logger.error(errorMessage);
      }
    }
  }
});

// New InteractionCreate handler for Slash Commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  logger.debug(`Received interaction: ${interaction.commandName} from ${interaction.user.tag}`);

  if (interaction.commandName === 'ping') {
    try {
      await interaction.reply('Pong!');
      logger.info(`Replied to /ping command from ${interaction.user.tag}`);
    } catch (error) {
      logger.error(`Error replying to /ping command: ${error}`);
    }
  }
  // Add handlers for other commands here if needed
});

// Log in to Discord with your client's token
client.login(DISCORD_BOT_TOKEN)
  .catch(error => {
    logger.error(`Failed to log in: ${error}`);
    if (error.code === 'TokenInvalid') {
        logger.error("Login failed: Invalid Discord Bot Token provided.");
    }
    process.exit(1); // Exit if login fails
}); 