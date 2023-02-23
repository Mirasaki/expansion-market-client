const { ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { marketServerOption, hasValidMarketServer } = require('../../lib/helpers/marketServers');
const clearCategoriesCommand = require('../market-categories/clear-categories');
const clearTradersCommand = require('../market-traders/clear-traders');
const clearZonesCommand = require('../market-zones/clear-zones');
const clearMapsCommand = require('../market-maps/clear-maps');

const {
  CONFIRMATION_PROMPT_OPTION_NAME,
  CONFIRMATION_PROMPT_OPTION_DESCRIPTION
} = require('../../constants');


module.exports = new ChatInputCommand({
  global: true,
  permLevel: 'Administrator',
  cooldown: {
    type: 'guild',
    usages: 2,
    duration: 1800
  },
  data: {
    description: 'Clear your full Expansion-Market configuration',
    options: [
      {
        name: CONFIRMATION_PROMPT_OPTION_NAME,
        description: CONFIRMATION_PROMPT_OPTION_DESCRIPTION,
        type: ApplicationCommandOptionType.Boolean,
        required: true
      },
      marketServerOption
    ]
  },

  run: async (client, interaction) => {
    // Destructuring
    const { member, options } = interaction;
    const { emojis } = client.container;

    // Deferring our reply
    await interaction.deferReply();

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Didn't check the confirmation prompt
    const confirmationPrompt = options.getBoolean(CONFIRMATION_PROMPT_OPTION_NAME);
    if (confirmationPrompt !== true) {
      interaction.editReply({
        content: `${emojis.error} ${member}, you didn't select **\`true\`** on the confirmation prompt, this command has been cancelled.`
      });
      return; // Escape out of the command early
    }

    // First, await a reply so we can properly followUp()
    await interaction.editReply({ content: `${emojis.wait} ${member}, please wait while your configuration is being cleared.` });

    // Yeah, that's right
    await clearCategoriesCommand.run(client, interaction);
    await clearTradersCommand.run(client, interaction);
    await clearZonesCommand.run(client, interaction);
    await clearMapsCommand.run(client, interaction);

    // And finally, user feedback, we done!
    await interaction.editReply({ content: `${emojis.success} ${member}, finished clearing your Expansion-Market configuration.` });
  }
});
