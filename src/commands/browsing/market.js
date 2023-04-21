const {
  ApplicationCommandOptionType, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder
} = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const {
  MARKET_BROWSE_AUTOCOMPLETE_OPTION,
  NO_MARKET_CONFIG_OPTION_VALUE,
  NO_MARKET_CONFIG_DISPLAY_STR,
  MARKET_ANNOTATION_3_STR,
  MARKET_ITEM_NO_MAP,
  MARKET_ITEM_NO_ZONE,
  EMBED_DESCRIPTION_MAX_LENGTH
} = require('../../constants');
const { prettifyClassName } = require('../../lib/helpers/in-game-names');
const {
  getMarketItemByName, getSettingsCache, getInGameNames, getAllMarketItems
} = require('../../lib/requests');
const { getItemDataEmbed, resolveAllPossibleItems } = require('../../lib/helpers/items');
const { getRuntime, colorResolver } = require('../../util');
const { hasValidMarketServer, marketServerOption } = require('../../lib/helpers/marketServers');
const emojis = require('../../config/emojis.json');

const handlePagination = async (interaction, member, usableEmbeds, className) => {
  let pageNow = 1;
  const prevCustomId = `@page-prev@${ member.id }@${ className }@${ Date.now() }`;
  const nextCustomId = `@page-next@${ member.id }@${ className }@${ Date.now() }`;
  const updateEmbedReply = (i) => i.update({
    embeds: [ usableEmbeds[pageNow - 1] ],
    components: getPaginationComponents(pageNow, usableEmbeds.length, prevCustomId, nextCustomId)
  });

  // Initial reply
  interaction.editReply({
    embeds: [ usableEmbeds[pageNow - 1] ],
    components: getPaginationComponents(pageNow, usableEmbeds.length, prevCustomId, nextCustomId)
  }).catch(() => { /* Void */ });

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
        i.reply({
          content: `${ emojis.error } ${ member }, you're on the first page, this action was cancelled.`, ephemeral: true
        });
        return;
      }
      else pageNow--;
    }
    // Next
    else if (i.customId === nextCustomId) {
      if (pageNow === usableEmbeds.length) {
        i.reply({
          content: `${ emojis.error } ${ member }, you're already viewing the last page, this action was cancelled.`, ephemeral: true
        });
        return;
      }
      else pageNow++;
    }

    // Update reply with new page index
    updateEmbedReply(i);
  });

  marketPaginationCollector.on('end', () => {
    interaction.editReply({ components: getPaginationComponents(
      pageNow,
      usableEmbeds.length,
      prevCustomId,
      nextCustomId,
      true
    ) }).catch(() => { /* Void */ });
  });
};

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

const handleQueryList = async (server, interaction, res, itemQuery, runtimeStart) => {
  itemQuery = itemQuery.toLowerCase();
  const { guild, member } = interaction;
  const inGameNames = await getInGameNames(server); // Cached in back-end

  // Find all possible combinations of in-game-names
  // and classnames, prettified, of course
  let everything;
  if (inGameNames.status !== 200) {
    const allRawItems = await getAllMarketItems(server);
    if (!allRawItems.data || !allRawItems.data[0]) {
      everything = [
        {
          name: 'No configuration, please use /set-market-config', value: NO_MARKET_CONFIG_OPTION_VALUE
        }
      ];
    }
    else everything = allRawItems
      .data
      .map((className) => ({
        name: prettifyClassName(className, false), value: className
      }));
  }
  else everything = resolveAllPossibleItems(inGameNames.data);

  // Return original res if nothing is found
  if (!everything || !everything[0]) {
    interaction.editReply({ content: `${ emojis.error } ${ member } - ${ res.message }` }).catch(() => { /* Void */ });
    return;
  }

  // Getting our search query's results
  const queryResult = everything.filter(
    (e) => e.name.toLowerCase().indexOf(itemQuery) >= 0
  );

  // Return original res if nothing is left after query filter
  if (!queryResult[0]) {
    interaction.editReply({ content: `${ emojis.error } ${ member } - ${ res.message }` }).catch(() => { /* Void */ });
    return;
  }

  const files = [];
  // eslint-disable-next-line sonarjs/no-nested-template-literals
  const queryStr = `\`\`\`\n${ queryResult.map((e) => `${ emojis.separator } ${ e.name }`).join('\n') }\n\`\`\``;

  // Attach as a file instead if the overview is too long
  if (queryStr.length > EMBED_DESCRIPTION_MAX_LENGTH) {
    // Create a new file holding the quick map overview
    files.push(
      new AttachmentBuilder(
        Buffer.from(queryStr
          .replace(/[*`]/g, '')
          .slice(1, -1)) // Slice of start and end newlines
      ).setName(`${ itemQuery }-query-results-${ guild.id }.txt`)
    );
  }

  // Performance tracking
  const runtime = getRuntime(runtimeStart).ms;

  // Show query results
  interaction.editReply({
    embeds: [
      {
        color: colorResolver(),
        author: {
          name: guild.name,
          icon_url: guild.iconURL({ dynamic: true })
        },
        title: 'Expansion Market query results',
        description: queryStr.length > EMBED_DESCRIPTION_MAX_LENGTH
          ? 'View query results in the attached file'
          : queryStr,
        footer: { text: `Total Results: ${ queryResult.length }\nTime Taken: ${ runtime }ms` }
      }
    ],
    files
  });
};

module.exports = new ChatInputCommand({
  global: true,
  aliases: [ 'trader' ],
  data: {
    description: 'Search the available Expansion Market items',
    options: [
      {
        name: MARKET_BROWSE_AUTOCOMPLETE_OPTION,
        description: `The ${ MARKET_BROWSE_AUTOCOMPLETE_OPTION } to query`,
        type: ApplicationCommandOptionType.String,
        autocomplete: true,
        required: true
      },
      marketServerOption
    ]
  },
  run: async (client, interaction) => {
    // Destructuring
    const {
      member, guild, options
    } = interaction;
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
    const itemQuery = options.getString(MARKET_BROWSE_AUTOCOMPLETE_OPTION)
      .replace(/[`*\\/]/g, '');

    // Check missing config
    if (itemQuery === NO_MARKET_CONFIG_OPTION_VALUE) {
      interaction.editReply(`${ emojis.error } ${ member }, ${ NO_MARKET_CONFIG_DISPLAY_STR }`);
      return;
    }

    // Fetch the item configuration
    // Item is attached as category.items[0]
    const res = await getMarketItemByName(server, itemQuery);

    // Query list
    if (res.status === 404) {
      handleQueryList(server, interaction, res, itemQuery, runtimeStart);
      return;
    }

    // Return if not OK
    else if (res.status !== 200) {
      interaction.editReply({ content: `${ emojis.error } ${ member } - ${ res.message }` }).catch(() => { /* Void */ });
      return;
    }

    // Return early if item is not tradable
    const settings = await getSettingsCache(guild.id);
    const { category, traders } = res.data;
    const item = category.items[0];
    let ign = item.displayName;
    if (!ign) ign = prettifyClassName(itemQuery, true);
    if (!traders || !traders[0]) {
      interaction.editReply({ content: `${ emojis.error } ${ member }, \`${ ign }\` currently isn't tradable` }).catch(() => { /* Void */ });
      return;
    }

    // Construct our embed response
    for await (const trader of traders) {
      embeds.push(await getItemDataEmbed(settings, itemQuery, category, trader));
    }

    // Filter out bad/returned embeds - this is intentional behavior,
    // otherwise we have to calculate annotations, etc twice
    let usableEmbeds = embeds.filter(
      (e) => e !== MARKET_ANNOTATION_3_STR && e !== MARKET_ITEM_NO_MAP && e !== MARKET_ITEM_NO_ZONE
    );

    // Fail-safe!
    // We can't reply to an interaction without content and 0 embeds =)
    if (!usableEmbeds[0]) {
      interaction.editReply({ content: `${ emojis.error } ${ member }, server configuration for Expansion-Market is incomplete! Be sure you use all of the \`/set\` commands - use /support if you're encountering issues.` }).catch(() => { /* Void */ });
      return;
    }

    // Prepend guild branding
    // and append performance measuring to all embeds
    const runtime = getRuntime(runtimeStart).ms;
    usableEmbeds = usableEmbeds.map((emb) => ({
      author: {
        name: `${ guild.name } - Market`,
        iconURL: guild.iconURL({ dynamic: true })
      },
      footer: {
        text: `Parsed and analyzed in: ${ runtime } ms`,
        iconURL: client.user.displayAvatarURL()
      },
      ...emb
    }));

    // Reply to the interaction with the SINGLE embed
    if (usableEmbeds.length === 1) interaction.editReply({ embeds: usableEmbeds }).catch(() => { /* Void */ });
    // Properly handle pagination for multiple embeds
    else handlePagination(interaction, member, usableEmbeds, itemQuery);
  }
});
