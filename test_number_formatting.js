#!/usr/bin/env node

const { formatGC, formatExactGC, formatApproxGC } = require('./src/number_formatter');

function testNumberFormatting() {
  console.log('🧪 Testing GarryCoin number formatting');
  console.log('');

  const testCases = [
    // Small numbers (should always use commas)
    { input: 0, expected: 'commas' },
    { input: 50, expected: 'commas' },
    { input: 999, expected: 'commas' },
    
    // Thousands
    { input: 1000, expected: '1K' },
    { input: 1500, expected: '1.5K' },
    { input: 2000, expected: '2K' },
    { input: 2564, expected: '2.56K' },
    { input: 9999, expected: '10K' }, // rounds up to whole
    { input: 10000, expected: '10K' },
    { input: 15000, expected: '15K' },
    { input: 15500, expected: '15.5K' },
    { input: 99900, expected: '99.9K' },
    { input: 100000, expected: '100K' },
    { input: 125000, expected: '125K' },
    
    // Millions  
    { input: 1000000, expected: '1M' },
    { input: 2000000, expected: '2M' },
    { input: 2100000, expected: '2.1M' },
    { input: 2560000, expected: '2.56M' },
    { input: 10000000, expected: '10M' },
    { input: 34500000, expected: '34.5M' },
    { input: 100000000, expected: '100M' },
    { input: 150200000, expected: '150M' }, // Should round
    
    // Billions
    { input: 1000000000, expected: '1B' },
    { input: 2000000000, expected: '2B' },
    { input: 2100000000, expected: '2.1B' },
    { input: 10000000000, expected: '10B' },
    { input: 125000000000, expected: '125B' },
    
    // Edge cases
    { input: -1500, expected: '-1.5K' },
    { input: -2100000, expected: '-2.1M' },
  ];

  console.log('📊 Testing formatApproxGC (abbreviated):');
  testCases.forEach(({ input, expected }) => {
    const result = formatApproxGC(input);
    let status;
    if (expected === 'commas') {
      // For small numbers, they should equal the localized string
      status = result === input.toLocaleString() ? '✅' : '❌';
    } else {
      status = result === expected ? '✅' : '❌';
    }
    console.log(`  ${input.toLocaleString()} → ${result} ${status} ${expected !== 'commas' ? `(expected: ${expected})` : ''}`);
  });

  console.log('');
  console.log('📊 Testing formatExactGC (with commas):');
  const exactTests = [2564, 150200000, 2100000];
  exactTests.forEach(input => {
    const result = formatExactGC(input);
    const hasCommas = result.includes(',');
    console.log(`  ${input} → ${result} ${hasCommas ? '✅' : '❌'} (should have commas)`);
  });
}

testNumberFormatting();