const { ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { MARKET_BROWSE_AUTOCOMPLETE_OPTION, NO_MARKET_CONFIG_OPTION_VALUE, NO_MARKET_CONFIG_DISPLAY_STR } = require('../../constants');
const { resolveInGameName } = require('../../lib/helpers/in-game-names');
const { getMarketItemByName } = require('../../lib/requests');
const { getItemDataEmbed } = require('../../lib/helpers/items');
const { getRuntime } = require('../../util');
const { hasValidMarketServer, marketServerOption } = require('../../lib/helpers/marketServers');

module.exports = new ChatInputCommand({
  global: true,
  aliases: ['trader'],
  data: {
    description: 'Search the available Expansion Market items',
    options: [
      marketServerOption,
      {
        name: MARKET_BROWSE_AUTOCOMPLETE_OPTION,
        description: `The ${MARKET_BROWSE_AUTOCOMPLETE_OPTION} to query`,
        type: ApplicationCommandOptionType.String,
        autocomplete: true,
        required: true
      }
    ]
  },
  run: async (client, interaction) => {
    // Destructuring
    const { member, guild, options } = interaction;
    const { emojis } = client.container;

    // Deferring our reply
    await interaction.deferReply();

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Declarations
    const runtimeStart = process.hrtime.bigint();
    const embeds = [];

    // Check REQUIRED auto-complete enabled "item" option
    const className = options.getString(MARKET_BROWSE_AUTOCOMPLETE_OPTION);

    // Check missing config
    if (className === NO_MARKET_CONFIG_OPTION_VALUE) {
      interaction.editReply(`${emojis.error} ${member}, ${NO_MARKET_CONFIG_DISPLAY_STR}`);
      return;
    }

    const res = await getMarketItemByName(server, className);

    // Return if not OK
    if (res.status !== 200) {
      interaction.editReply({
        content: `${emojis.error} ${member} - ${res.message}`
      });
      return;
    }

    // Return early if item is not tradable
    const { category, traders } = res.data;
    if (!traders || !traders[0]) {
      interaction.editReply({
        content: `${emojis.error} ${member}, \`${await resolveInGameName(server, className)}\` currently isn't tradable`
      });
      return;
    }

    // Construct our embed response
    for await (const trader of traders) {
      embeds.push(await getItemDataEmbed(className, category, trader));
    }

    // Fail-safe!
    // We can't reply to an interaction without content and 0 embeds =)
    if (!embeds[0]) {
      interaction.editReply({
        content: `${emojis.error} ${member}, server configuration for Expansion-Market is incomplete! Be sure you use all of the \`/set\` commands - use /support if you're encountering issues.`
      });
      return;
    }

    // Prepend guild branding to first embed
    embeds[0].author = {
      name: `${guild.name} - Market`,
      iconURL: guild.iconURL({ dynamic: true })
    };

    // Append performance measure to final embed
    embeds[embeds.length - 1].footer = {
      text: `Parsed and analyzed in: ${getRuntime(runtimeStart).ms} ms`,
      iconURL: client.user.displayAvatarURL()
    };

    // Reply to the interaction
    interaction.editReply({ embeds });
  }
});
