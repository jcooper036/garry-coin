// GarryCoin number formatting utilities

/**
 * Format numbers for display with smart comma/abbreviation logic
 * @param {number} amount - The number to format
 * @param {boolean} forceCommas - If true, always use commas even for large numbers
 * @returns {string} - Formatted number string
 */
function formatGC(amount, forceCommas = false) {
  if (!amount && amount !== 0) return '0';
  
  const num = parseInt(amount);
  
  // Always use commas for small numbers or when forced
  if (Math.abs(num) < 1000 || forceCommas) {
    return num.toLocaleString();
  }
  
  // For large numbers, use abbreviations but keep to max 3 digits
  const absNum = Math.abs(num);
  const isNegative = num < 0;
  const prefix = isNegative ? '-' : '';
  
  if (absNum >= 1000000000) { // Billions
    const billions = absNum / 1000000000;
    if (billions >= 100) {
      // 100B+ -> show as whole billions
      return `${prefix}${Math.round(billions)}B`;
    } else if (billions >= 10) {
      // 10.0B - 99.9B -> show 1 decimal (unless whole number)
      const rounded = Math.round(billions * 10) / 10;
      return `${prefix}${rounded === Math.floor(rounded) ? Math.floor(rounded) : rounded.toFixed(1)}B`;
    } else {
      // 1.00B - 9.99B -> show 2 decimals (unless whole number)
      const rounded = Math.round(billions * 100) / 100;
      if (rounded === Math.floor(rounded)) {
        return `${prefix}${Math.floor(rounded)}B`; // 1B, 2B, etc.
      } else if (rounded * 10 === Math.floor(rounded * 10)) {
        return `${prefix}${rounded.toFixed(1)}B`; // 1.5B, 2.3B, etc.
      } else {
        return `${prefix}${rounded.toFixed(2)}B`; // 1.23B, 2.45B, etc.
      }
    }
  } else if (absNum >= 1000000) { // Millions
    const millions = absNum / 1000000;
    if (millions >= 100) {
      // 100M+ -> show as whole millions
      return `${prefix}${Math.round(millions)}M`;
    } else if (millions >= 10) {
      // 10.0M - 99.9M -> show 1 decimal (unless whole number)
      const rounded = Math.round(millions * 10) / 10;
      return `${prefix}${rounded === Math.floor(rounded) ? Math.floor(rounded) : rounded.toFixed(1)}M`;
    } else {
      // 1.00M - 9.99M -> show 2 decimals (unless whole number)
      const rounded = Math.round(millions * 100) / 100;
      if (rounded === Math.floor(rounded)) {
        return `${prefix}${Math.floor(rounded)}M`; // 1M, 2M, etc.
      } else if (rounded * 10 === Math.floor(rounded * 10)) {
        return `${prefix}${rounded.toFixed(1)}M`; // 1.5M, 2.3M, etc.
      } else {
        return `${prefix}${rounded.toFixed(2)}M`; // 1.23M, 2.45M, etc.
      }
    }
  } else if (absNum >= 1000) { // Thousands
    const thousands = absNum / 1000;
    
    // First round to see if it bumps up to 10+
    const roundedForCheck = Math.round(thousands * 100) / 100;
    
    if (roundedForCheck >= 100) {
      // 100K+ -> show as whole thousands
      return `${prefix}${Math.round(thousands)}K`;
    } else if (roundedForCheck >= 10) {
      // 10.0K - 99.9K -> show 1 decimal (unless whole number)
      const rounded = Math.round(thousands * 10) / 10;
      return `${prefix}${rounded === Math.floor(rounded) ? Math.floor(rounded) : rounded.toFixed(1)}K`;
    } else {
      // 1.00K - 9.99K -> show 2 decimals (unless whole number)
      if (roundedForCheck === Math.floor(roundedForCheck)) {
        return `${prefix}${Math.floor(roundedForCheck)}K`; // 1K, 2K, etc.
      } else if (roundedForCheck * 10 === Math.floor(roundedForCheck * 10)) {
        return `${prefix}${roundedForCheck.toFixed(1)}K`; // 1.5K, 2.3K, etc.
      } else {
        return `${prefix}${roundedForCheck.toFixed(2)}K`; // 1.23K, 2.45K, etc.
      }
    }
  }
  
  // This shouldn't happen given our logic above, but fallback
  return num.toLocaleString();
}

/**
 * Format for exact amounts where precision matters (like winnings)
 */
function formatExactGC(amount) {
  return formatGC(amount, true);
}

/**
 * Format for approximate amounts where abbreviation is preferred
 */
function formatApproxGC(amount) {
  return formatGC(amount, false);
}

module.exports = {
  formatGC,
  formatExactGC,
  formatApproxGC
};