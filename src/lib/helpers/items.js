const { stripIndents } = require('common-tags');
const { colorResolver } = require('../../util');
const { prettifyClassName, resolveInGameName, bulkResolveInGameNames, matchResolvedInGameNameArray } = require('./in-game-names');

const resolveAllPossibleItems = (data) => {
  const { valid, notInItemList } = data;

  // Concatenate [ className, inGameName ] from "valid"
  // into our notInItemList array
  return notInItemList
    .map((e) => ({ name: prettifyClassName(e, false), value: e }))
    .concat( Object.entries(valid).map(([k, v]) => ({ name: v, value: k })) );
};

const resolveItemStock = (item, category, zone) => {
  // Find this item entry in zone stock configuration
  const itemZoneStockEntry = Object.entries(zone.stock)
    .find(([zoneItemClass, zoneItemStock]) => zoneItemClass === item.className);

  // Check if this item exists in the zone configuration
  const itemStockLevel = itemZoneStockEntry
    ? itemZoneStockEntry[1]
    : 0 /*'[DEV] Implement fallback'*/;

  // https://github.com/salutesh/DayZ-Expansion-Scripts/wiki/%5BServer-Hosting%5D-Market-TraderZones-Settings#stock
  // If zone stock entry level is 0,
  // this means the item is only tradable after players sell it here
  const zoneStockStr = itemStockLevel === 0
    ? (
      item.maxStockThreshold !== item.minStockThreshold
      && item.maxStockThreshold >= 1
      && category.initStockPercent >= 1
    )
      ? Math.round((item.maxStockThreshold / 100) * zone.InitStockPercent)
      : 'The amount of items players sold here'
    : itemStockLevel;

  // Always return our output string
  return zoneStockStr;
};

const resolveBuyPriceOutput = async (item, trader, zone) => {
  // Use zone buyPricePercent if a valid value is provided
  const activeBuyPercent = (
    !isNaN(zone.buyPricePercent)
    && zone.buyPricePercent >= 1
    && zone.buyPricePercent <= 999
  )
    // Always use 2 decimal precision
    ? (Math.round(zone.buyPricePercent * 100) / 100).toFixed(2)
    : 100; // 100% by default

  // Calculate dynamic prices
  const buyDynamicHigh = Math.round((item.maxPriceThreshold / 100) * activeBuyPercent);
  const buyDynamicLow = Math.round((item.minPriceThreshold / 100) * activeBuyPercent);

  // Resolve the currency name to display
  const currencyDisplayName = await resolveInGameName(trader.MarketServerId, trader.lowestCurrency);

  // Construct our final string
  const buyPrice = item.hasStaticPrice
    ? `- ${buyDynamicHigh} ${currencyDisplayName}`
    : stripIndents`
      - Low:  ${buyDynamicLow}
      - High: ${buyDynamicHigh}
      ---
      ${currencyDisplayName}
    `;

  // Always return our buy price str
  return buyPrice;
};

const resolveSellPriceOutput = async (item, trader, zone) => {
  // Check if this item is configured to use the
  // zone sell price percent
  // By default this value is -1.0, meaning the global value from
  // market settings will be used, but can be overridden by
  // setting this to the desired percentage.
  const itemUsesZoneSellPercent = item.sellPricePercent === -1 || item.sellPricePercent === '-1' || typeof SellPricePercent === 'undefined';

  // Check which sellPricePercent to use
  const activeSellPercent = itemUsesZoneSellPercent
    ? zone.sellPricePercent === -1 || zone.sellPricePercent === '-1' // By default this value is -1.0, meaning the global value from market settings will be used, but can be overridden by setting this to the desired percentage.
      ? 50 // [DEV] - Implement global fallback - defined somewhere in a config file
      : (Math.round(zone.sellPricePercent * 100) / 100).toFixed(2) // Use zone SellPricePercent
    : (Math.round(item.sellPricePercent * 100) / 100).toFixed(2); // Use item SellPricePercent

  // Calculate dynamic prices
  const sellDynamicHigh = Math.round((item.maxPriceThreshold / 100) * activeSellPercent);
  const sellDynamicLow = Math.round((item.minPriceThreshold / 100) * activeSellPercent);

  // Resolve the currency name to display
  const currencyDisplayName = await resolveInGameName(trader.MarketServerId, trader.lowestCurrency);

  // Construct our final string
  const sellPrice = item.hasStaticPrice
    ? `+ ${sellDynamicHigh} ${currencyDisplayName}`
    : stripIndents`
    + Low:  ${sellDynamicLow}
    + High: ${sellDynamicHigh}
    ---
    ${currencyDisplayName}
  `;

  return sellPrice;
};

const getItemDataEmbed = async (className, category, trader) => {
  const item = category.items[0];
  console.log('\n\n\n');
  console.dir({ trader, item }, { depth: 1 });
  console.log('\n\n\n');
  const ign = await resolveInGameName(category.MarketServerId, className);
  const map = trader.MarketTraderMap;
  const zone = map.MarketTraderZoneConfig;

  // Prepare to check for special item annotation
  let activeAnnotation;
  let hasAnnotation = false;
  const traderAnnotation = Object.entries(trader.items).find(([key, value]) => key === className);
  const categoryAnnotation = trader.categories.find((str) => {
    str = str.toLowerCase();
    if (str.indexOf(':') >= 1) return str.slice(0, str.indexOf(':')) === category.categoryName.toLowerCase();
    else return str === category.categoryName.toLowerCase();
  });

  // Trader#Items annotation - More specific annotation, takes priority over Trader#Categories below
  if (traderAnnotation) {
    hasAnnotation = true;
    activeAnnotation = String(traderAnnotation[1]);
  }
  // Trader#Categories annotation
  else if (categoryAnnotation) {
    hasAnnotation = categoryAnnotation.indexOf(':') >= 1;
    activeAnnotation = categoryAnnotation.slice(
      categoryAnnotation.indexOf(':') + 1,
      categoryAnnotation.length
    );
  }

  // Define our initial, unconditional embed
  const embed = {
    title: ign,
    color: colorResolver(),
    fields: [
      {
        name: 'Category',
        value: category.categoryName,
        inline: true
      },
      {
        name: 'Trader',
        value: trader.displayName,
        inline: true
      },
      {
        name: 'Trader Zone',
        value: zone.m_DisplayName,
        inline: false
      },
      {
        name: 'Buy',
        value: `\`\`\`diff\n${
          hasAnnotation && (activeAnnotation === '2' || activeAnnotation === '3')
            ? '- n/a'
            : await resolveBuyPriceOutput(item, trader, zone)
        }\n\`\`\``,
        inline: true
      },
      {
        name: 'Sell',
        value: `\`\`\`diff\n${
          hasAnnotation && (activeAnnotation === '0' || activeAnnotation === '3')
            ? '+ n/a'
            : await resolveSellPriceOutput(item, trader, zone)
        }\n\`\`\``,
        inline: true
      }
    ]
  };

  // Display stock level if not static
  if (!item.hasStaticStock) {
    embed.fields.push({
      name: 'Stock',
      value: resolveItemStock(item, category, zone),
      inline: false
    });
  }

  // Display SpawnAttachments conditionally
  if (item.spawnAttachments.length >= 1) {
    const resolvedCurrencyArray = matchResolvedInGameNameArray(
      item.spawnAttachments,
      await bulkResolveInGameNames(category.MarketServerId, item.spawnAttachments)
    );
    embed.fields.push({
      name: 'Attachments',
      value: `\`\`\`diff\n• ${resolvedCurrencyArray.join('\n• ')}\`\`\``,
      inline: true
    });
  }

  // Display Variants conditionally
  if (item.variants.length >= 1) {
    const resolvedCurrencyArray = matchResolvedInGameNameArray(
      item.variants,
      await bulkResolveInGameNames(category.MarketServerId, item.variants)
    );
    embed.fields.push({
      name: 'Variants',
      value: `\`\`\`diff\n• ${resolvedCurrencyArray.join('\n• ')}\`\`\``,
      inline: true
    });
  }


  return embed;
};

module.exports = {
  resolveAllPossibleItems,
  resolveItemStock,
  resolveBuyPriceOutput,
  getItemDataEmbed
};
