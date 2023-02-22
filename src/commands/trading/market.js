const { ApplicationCommandOptionType, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { MARKET_BROWSE_AUTOCOMPLETE_OPTION, NO_MARKET_CONFIG_OPTION_VALUE, NO_MARKET_CONFIG_DISPLAY_STR, MARKET_ANNOTATION_3_STR } = require('../../constants');
const { resolveInGameName } = require('../../lib/helpers/in-game-names');
const { getMarketItemByName } = require('../../lib/requests');
const { getItemDataEmbed } = require('../../lib/helpers/items');
const { getRuntime } = require('../../util');
const { hasValidMarketServer, marketServerOption } = require('../../lib/helpers/marketServers');

const getPaginationComponents = (pageNow, pageTotal, prevCustomId, nextCustomId, disableAll = false) => {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(prevCustomId)
          .setLabel('Previous')
          .setDisabled(!!(disableAll || pageNow === 1))
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(nextCustomId)
          .setLabel('Next')
          .setDisabled(!!(disableAll || pageNow === pageTotal))
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Primary)
      )
  ];
};

module.exports = new ChatInputCommand({
  global: true,
  aliases: ['trader'],
  data: {
    description: 'Search the available Expansion Market items',
    options: [
      {
        name: MARKET_BROWSE_AUTOCOMPLETE_OPTION,
        description: `The ${MARKET_BROWSE_AUTOCOMPLETE_OPTION} to query`,
        type: ApplicationCommandOptionType.String,
        autocomplete: true,
        required: true
      },
      marketServerOption
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

    // Filter out bad/returned embeds - this is intentional behavior,
    // otherwise we have to calculate annotations, etc twice
    let usableEmbeds = embeds.filter((e) => e !== MARKET_ANNOTATION_3_STR);

    // Fail-safe!
    // We can't reply to an interaction without content and 0 embeds =)
    if (!usableEmbeds[0]) {
      interaction.editReply({
        content: `${emojis.error} ${member}, server configuration for Expansion-Market is incomplete! Be sure you use all of the \`/set\` commands - use /support if you're encountering issues.`
      });
      return;
    }

    // Prepend guild branding
    // and append performance measuring to all embeds
    usableEmbeds = usableEmbeds.map((emb) => ({
      author: {
        name: `${guild.name} - Market`,
        iconURL: guild.iconURL({ dynamic: true })
      },
      footer: {
        text: `Parsed and analyzed in: ${getRuntime(runtimeStart).ms} ms`,
        iconURL: client.user.displayAvatarURL()
      },
      ...emb
    }));

    // Reply to the interaction
    if (usableEmbeds.length === 1) interaction.editReply({ embeds: usableEmbeds });
    // Properly handle pagination for multiple embeds
    else {
      let pageNow = 1;
      const prevCustomId = `@page-prev@${member.id}@${className}@${Date.now()}`;
      const nextCustomId = `@page-next@${member.id}@${className}@${Date.now()}`;
      const updateEmbedReply = (i) => i.update({
        embeds: [usableEmbeds[pageNow - 1]],
        components: getPaginationComponents(pageNow, usableEmbeds.length, prevCustomId, nextCustomId)
      });

      // Initial reply
      interaction.editReply({
        embeds: [usableEmbeds[pageNow - 1]],
        components: getPaginationComponents(pageNow, usableEmbeds.length, prevCustomId, nextCustomId)
      });

      // Fetching the message attached to the received interaction
      const interactionMessage = await interaction.fetchReply();
      // Button reply/input collector
      const marketPaginationCollector = interactionMessage.createMessageComponentCollector({
        filter: (i) => (
          // Filter out custom ids
          i.customId === prevCustomId || i.customId === nextCustomId
        ) && i.user.id === interaction.user.id, // Filter out people without access to the command
        componentType: ComponentType.Button,
        time: 180_000
      });

      // And finally, running code when it collects an interaction (defined as "i" in this callback)
      marketPaginationCollector.on('collect', (i) => {
        // Prev
        if (i.customId === prevCustomId) {
          if (pageNow === 1) {
            i.reply({ content: `${emojis.error} ${member}, you're on the first page, this action was cancelled.`, ephemeral: true });
            return;
          }
          else pageNow--;
        }
        // Next
        else if (i.customId === nextCustomId) {
          if (pageNow === embeds.length) {
            i.reply({ content: `${emojis.error} ${member}, you're already viewing the last page, this action was cancelled.`, ephemeral: true });
            return;
          }
          else pageNow++;
        }

        // Update reply with new page index
        updateEmbedReply(i);
      });

      marketPaginationCollector.on('end', () => {
        interaction.editReply({ components: getPaginationComponents(pageNow, usableEmbeds.length, prevCustomId, nextCustomId, true) });
      });
    }
  }
});
