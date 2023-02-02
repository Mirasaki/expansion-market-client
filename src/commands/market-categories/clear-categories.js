const { ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { MARKET_CATEGORIES_FILE_DESCRIPTION, CONFIRMATION_PROMPT_OPTION_NAME, CONFIRMATION_PROMPT_OPTION_DESCRIPTION } = require('../../constants');
const { getClientErrorEmbed } = require('../../lib/client');
const { marketServerOption, hasValidMarketServer } = require('../../lib/helpers/marketServers');
const { deleteMarketCategories } = require('../../lib/requests');

module.exports = new ChatInputCommand({
  cooldown: {
    usages: 1,
    duration: 30,
    type: 'guild'
  },
  data: {
    description: `Clear/delete your ${MARKET_CATEGORIES_FILE_DESCRIPTION}`,
    options: [
      marketServerOption,
      {
        name: CONFIRMATION_PROMPT_OPTION_NAME,
        description: CONFIRMATION_PROMPT_OPTION_DESCRIPTION,
        type: ApplicationCommandOptionType.Boolean,
        required: true
      }
    ]
  },

  run: async (client, interaction) => {
    // Destructuring
    const { member, options } = interaction;
    const { emojis } = client.container;
    const confirmationPrompt = options.getBoolean(CONFIRMATION_PROMPT_OPTION_NAME);

    // Deferring our reply
    await interaction.deferReply();

    // Didn't check the confirmation prompt
    if (confirmationPrompt !== true) {
      interaction.editReply({
        content: `${emojis.error} ${member}, you didn't select **\`true\`** on the confirmation prompt, this command has been cancelled.`
      });
      return; // Escape out of the command early
    }

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Checked true on confirmation prompt
    const res = await deleteMarketCategories(server);

    // 200 - OK - Deleted {{num}} categories
    if (res.status === 200) {
      interaction.editReply({
        content: `${emojis.success} ${member} - ${res.message}`
      });
    }

    // 404 - Not Found
    else if (res.status === 404) {
      interaction.editReply({
        content: `${emojis.error} ${member}, there is no ${MARKET_CATEGORIES_FILE_DESCRIPTION} active for this server configuration.`
      });
    }

    // Not 200/OK
    else {
      interaction.editReply({
        embeds: [getClientErrorEmbed(res)]
      });
    }
  }
});
