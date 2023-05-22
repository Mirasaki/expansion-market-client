const { ApplicationCommandOptionType, PermissionsBitField } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { hasValidMarketServer, requiredMarketServerOption } = require('../../lib/helpers/marketServers');
const setCategoriesCommand = require('../market-categories/set-categories');
const setTradersCommand = require('../market-traders/set-traders');
const setZonesCommand = require('../market-zones/set-zones');
const setMapsCommand = require('../market-maps/set-maps');

const {
  MARKET_CATEGORIES_OPTION_NAME,
  MARKET_TRADERS_OPTION_NAME,
  MARKET_TRADER_ZONES_OPTION_NAME,
  MARKET_TRADER_MAPS_OPTION_NAME
} = require('../../constants');

module.exports = new ChatInputCommand({
  global: true,
  permLevel: 'Administrator',
  cooldown: {
    type: 'guild',
    usages: 2,
    duration: 1800
  },
  clientPerms: [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.ReadMessageHistory,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.AttachFiles,
    PermissionsBitField.Flags.ManageMessages
  ],
  data: {
    description: 'Upload your server\'s full Expansion-Market configuration',
    options: [
      requiredMarketServerOption,
      // Categories
      {
        type: ApplicationCommandOptionType.Attachment,
        name: MARKET_CATEGORIES_OPTION_NAME,
        description: 'server/profiles/ExpansionMod/Market',
        required: true
      },
      // Traders
      {
        type: ApplicationCommandOptionType.Attachment,
        name: MARKET_TRADERS_OPTION_NAME,
        description: 'server/profiles/ExpansionMod/Traders',
        required: true
      },
      // Zones
      {
        type: ApplicationCommandOptionType.Attachment,
        name: MARKET_TRADER_ZONES_OPTION_NAME,
        description: 'server/mpmissions/your.mission/expansion/traderzones',
        required: true
      },
      // Maps
      {
        type: ApplicationCommandOptionType.Attachment,
        name: MARKET_TRADER_MAPS_OPTION_NAME,
        description: 'server/mpmissions/your.mission/expansion/traders',
        required: true
      }
    ]
  },

  run: async (client, interaction) => {
    // Destructuring
    const { member } = interaction;
    const { emojis } = client.container;

    // Deferring our reply
    await interaction.deferReply();

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Yeah, that's right
    await setCategoriesCommand.run(client, interaction);
    await setTradersCommand.run(client, interaction);
    await setZonesCommand.run(client, interaction);
    await setMapsCommand.run(client, interaction);

    // And finally, user feedback, we done!
    await interaction.editReply({ content: `${ emojis.success } ${ member }, finished uploading and parsing your Expansion-Market configuration.` }).catch(() => { /* Void */ });
    await interaction.followUp({ content: `${ emojis.success } ${ member }, finished uploading and parsing your Expansion-Market configuration, you can now use the \`/market\` command.\n\nDid you know that the bot supports in-game names? You should totally check out [the website](https://mirasaki.dev/gmt/in-game-names) to learn how to configure in-game names for your server.` });
  }
});
