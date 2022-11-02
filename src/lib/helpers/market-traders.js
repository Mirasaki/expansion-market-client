const digitCaptureGroupRegex = /(\d)+/g;

const getAllLowestCurrencies = (traders) => [ ...new Set(
  traders.map((trader) => trader.lowestCurrency)
) ]; // spread from Set to easily filter out uniques

const getAllCurrencies = (traders) => [ ...new Set(
  traders
    .map((trader) => trader.currencies)
    .flat() // Creates a new array with all sub-array elements concatenated into it recursively up to the specified depth.
)];

const formatAmountInCurrency = (currencies, escapeWith = '**') => {
  const resolved = [];
  // Loop over the array
  for (const currency of currencies) {
    let formattedCurr = currency;
    // Find all our digit capture groups
    const results = currency.match(digitCaptureGroupRegex);
    // Replace the capture groups with the escape character
    if (results) {
      for (const result of results) {
        formattedCurr = currency.replaceAll(result, `${escapeWith}${result}${escapeWith}`);
      }
    }

    // Finally push to the final array
    resolved.push(formattedCurr);
  }

  // Return the modified currencies
  return resolved;
};

module.exports = {
  digitCaptureGroupRegex,
  getAllLowestCurrencies,
  getAllCurrencies,
  formatAmountInCurrency
};
