const { ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { MARKET_TRADERS_FILE_DESCRIPTION, CONFIRMATION_PROMPT_OPTION_NAME, CONFIRMATION_PROMPT_OPTION_DESCRIPTION } = require('../../constants');
const { getClientErrorEmbed } = require('../../lib/client');
const { deleteMarketCategories } = require('../../lib/requests');


module.exports = new ChatInputCommand({
  cooldown: {
    usages: 1,
    duration: 30,
    type: 'guild'
  },
  data: {
    description: `Clear/delete your ${MARKET_TRADERS_FILE_DESCRIPTION}`,
    options: [{
      name: CONFIRMATION_PROMPT_OPTION_NAME,
      description: CONFIRMATION_PROMPT_OPTION_DESCRIPTION,
      type: ApplicationCommandOptionType.Boolean,
      required: true
    }]
  },

  run: async (client, interaction) => {
    // Destructuring
    const { member, guild, options } = interaction;
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

    // Checked true on confirmation prompt
    const res = await deleteMarketCategories(guild.id);

    // 200 - OK - Deleted {{num}} categories
    if (res.status === 200) {
      interaction.editReply({
        content: `${emojis.success} ${member}, ${res.message}`
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
