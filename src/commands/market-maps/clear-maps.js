const { ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { MARKET_TRADER_MAPS_FILE_DESCRIPTION, CONFIRMATION_PROMPT_OPTION_NAME, CONFIRMATION_PROMPT_OPTION_DESCRIPTION } = require('../../constants');
const { getClientErrorEmbed } = require('../../lib/client');
const { marketServerOption, hasValidMarketServer } = require('../../lib/helpers/marketServers');
const { deleteMarketTraderMaps } = require('../../lib/requests');


module.exports = new ChatInputCommand({
  global: true,
  enabled:  false,
  cooldown: {
    usages: 1,
    duration: 30,
    type: 'guild'
  },
  data: {
    description: `Clear/delete your ${MARKET_TRADER_MAPS_FILE_DESCRIPTION}`,
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
    const confirmationPrompt = options.getBoolean(CONFIRMATION_PROMPT_OPTION_NAME);

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Didn't check the confirmation prompt
    if (confirmationPrompt !== true) {
      interaction.followUp({
        content: `${emojis.error} ${member}, you didn't select **\`true\`** on the confirmation prompt, this command has been cancelled.`
      });
      return; // Escape out of the command early
    }

    // Checked true on confirmation prompt
    const res = await deleteMarketTraderMaps(server);

    // 200 - OK - Deleted {{num}} traders
    if (res.status === 200) {
      interaction.followUp({
        content: `${emojis.success} ${member} - ${res.message} (usually deleted by relation/association to traders and trader-zones)`
      });
    }

    // 404 - Not Found
    else if (res.status === 404) {
      interaction.followUp({
        content: `${emojis.error} ${member}, there is no ${MARKET_TRADER_MAPS_FILE_DESCRIPTION} active for this server.`
      });
    }

    // Not 200/OK
    else {
      interaction.followUp({
        embeds: [getClientErrorEmbed(res)]
      });
    }
  }
});
