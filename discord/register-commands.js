import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

// Configure logging (basic)
const logger = {
  info: (message) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`),
  error: (message) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`),
};

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
    logger.error('Error: DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID must be set in .env');
    process.exit(1);
}

// Define the slash commands
const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
    // Add other commands here
].map(command => command.toJSON());

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(token);

// Deploy commands
(async () => {
    try {
        logger.info(`Started refreshing ${commands.length} application (/) commands.`);

        let route;
        // Use guild-specific route if GUILD_ID is set for faster testing
        if (guildId) {
             logger.info(`Registering commands to guild ${guildId}`);
             route = Routes.applicationGuildCommands(clientId, guildId);
        } else {
            logger.info('Registering commands globally');
            route = Routes.applicationCommands(clientId);
        }

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(
            route,
            { body: commands },
        );

        logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        logger.error(error);
    }
})(); 