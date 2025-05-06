import { Client, GatewayIntentBits, Events, Collection, REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'node:fs';
import winston from 'winston';
import axios from 'axios';

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    // Optional: Add file transport
    // new winston.transports.File({ filename: 'discord-bot.log' })
  ],
});

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config(); // Load default .env

// Get configuration from environment variables
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const API_ENDPOINT = process.env.API_ENDPOINT;
const SITE_URL = 'https://indiefindr.gg';
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
if (!API_ENDPOINT) {
  logger.error('Error: API_ENDPOINT environment variable not set (should be the base URL for your API, e.g., http://localhost:3000/api).');
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
      const submitUrl = `${API_ENDPOINT}/find`; // Construct URL
      logger.debug(`Preparing to send payload: ${JSON.stringify(payload)} to ${submitUrl}`);

      try {
        // Make POST request to the API endpoint using fetch
        const response = await fetch(submitUrl, {
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

        logger.info(`Successfully posted data (${Object.keys(payload).join('=...')}) to ${submitUrl}. Status: ${response.status}`);

        // --- Add Reply Logic --- 
        try {
          const responseData = await response.json();
          const findId = responseData.findId;

          if (findId) {
            // Construct URL using the SITE_URL (which should be the site URL)
            const findUrl = `${SITE_URL}/finds/${findId}`;
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
        let errorMessage = `Failed to post data to ${submitUrl} for link ${linkOrIdForLog}.`;

        // Log request details
        errorMessage += `\n  Request Method: POST`;
        errorMessage += `\n  Request Headers: ${JSON.stringify({ 'Content-Type': 'application/json' })}`;
        errorMessage += `\n  Request Payload: ${JSON.stringify(payload)}`;

        // Updated error handling for fetch
        if (error instanceof Error) {
          errorMessage += `\n  Error: ${error.message}`; // Includes status and body if thrown from response.ok check
        } else {
          errorMessage += `\n  Unknown error object: ${error}`;
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
  // --- MONTHLY FINDS COMMAND --- (Simplified API URL)
  else if (interaction.commandName === 'monthly_finds') {
    try {
      await interaction.deferReply();

      const recentFindsUrl = `${API_ENDPOINT}/finds/recent?range=month`; // Construct URL
      logger.info(`Fetching monthly finds from API: ${recentFindsUrl}`);

      const response = await fetch(recentFindsUrl); // Use fetch instead of axios.get

      if (!response.ok) { // Check response.ok for fetch
          const errorText = await response.text(); // Get error text if available
          throw new Error(`API error! Status: ${response.status} - ${response.statusText}. Body: ${errorText}`);
      }

      const finds = await response.json(); // Parse JSON from fetch response
      if (!Array.isArray(finds)) {
          logger.error('API response for monthly finds was not an array:', finds);
          throw new Error('Received invalid data format from API.');
      }
      logger.info(`Received ${finds.length} finds from the API.`);

      if (finds.length === 0) {
        await interaction.editReply('No indie games found this month yet.');
        return;
      }

      const displayLimit = 20;
      const limitedFinds = finds.slice(0, displayLimit);

      let replyMessage = `**Indie Game Finds This Month (${limitedFinds.length}${finds.length > displayLimit ? ' of ' + finds.length : ''} results):**\n\n`;

      limitedFinds.forEach((find, index) => {
        const findId = find.id || 'UnknownID';
        const findTitle = find.title || `Find ID ${findId}`;
        const steamAppId = find.steamAppId;

        const findUrl = `${SITE_URL}/finds/${findId}`; // Use hardcoded SITE_URL
        const steamLink = steamAppId ? ` | [Steam Store](https://store.steampowered.com/app/${steamAppId})` : '';
        replyMessage += `${index + 1}. **${findTitle}** - [View Details](${findUrl})${steamLink}\n`;
      });

      if (replyMessage.length > 2000) {
        replyMessage = replyMessage.substring(0, 1990) + '... (list truncated)';
      }

      await interaction.editReply(replyMessage);
      logger.info(`Replied to /monthly_finds for ${interaction.user.tag} with ${limitedFinds.length} results.`);

    } catch (error) {
      logger.error(`Error processing /monthly_finds command: ${error}`);
      // Adjust error message handling slightly as fetch errors might not have response.data
      const errorMessage = error instanceof Error ? error.message : 'There was an error fetching the monthly finds.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `Error: ${errorMessage}`, ephemeral: true });
      } else {
        await interaction.reply({ content: `Error: ${errorMessage}`, ephemeral: true });
      }
    }
  }

  // Handle commands loaded from files (if any)
  const command = client.commands.get(interaction.commandName);
  // Update the check here to exclude only handled commands ('ping', 'monthly_finds')
  if (command && interaction.commandName !== 'ping' && interaction.commandName !== 'monthly_finds') {
    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}: ${error}`);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  }
});

// --- Define Slash Commands --- (Moved from register-commands.js)
const commandsToRegister = [
    new SlashCommandBuilder()
        .setName('monthly_finds')
        .setDescription('Lists indie games found this month.'),
    // Add other commands here if needed
].map(command => command.toJSON());

// --- Register Commands Function ---
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
    try {
        logger.info(`Started refreshing ${commandsToRegister.length} application (/) commands.`);

        let route;
        // Use guild-specific route if GUILD_ID is set for faster testing
        // Ensure GUILD_ID is defined if you uncomment the check above
        if (GUILD_ID) {
             logger.info(`Registering commands to guild ${GUILD_ID}`);
             route = Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID);
        } else {
            logger.info('Registering commands globally (can take up to an hour to propagate).');
            route = Routes.applicationCommands(CLIENT_ID);
        }

        // The put method is used to fully refresh all commands with the current set
        const data = await rest.put(
            route,
            { body: commandsToRegister },
        );

        logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        logger.error('Failed to register application commands:', error);
    }
}

// --- Main Execution: Register Commands then Login ---
(async () => {
    await registerCommands(); // Register commands before logging in
    
    // Log in to Discord
    client.login(DISCORD_BOT_TOKEN)
      .catch(error => {
        logger.error(`Failed to log in: ${error}`);
        if (error.code === 'TokenInvalid') {
            logger.error("Login failed: Invalid Discord Bot Token provided.");
        }
        process.exit(1);
    });
})(); 