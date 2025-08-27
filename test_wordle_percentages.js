#!/usr/bin/env node

// Test the new percentage-based Wordle reward calculations

const REWARD_STRUCTURE_PERCENT = {
    1: 20,
    2: 10,
    3: 5,
    4: 2,
    5: 1,
    6: 1,
};
const CHEAT_PENALTY_PERCENT = 4;

function testPercentageCalculations() {
    console.log('🧪 Testing Wordle percentage-based rewards');
    console.log('');

    const testBalances = [1000, 500, 100, 50, 10, 0];
    
    for (const balance of testBalances) {
        console.log(`💰 Testing with ${balance} GC balance:`);
        
        // Test all solve attempts
        for (const tries of [1, 2, 3, 4, 5, 6]) {
            const rewardPercent = REWARD_STRUCTURE_PERCENT[tries] / 100;
            const reward = Math.ceil(balance * rewardPercent);
            console.log(`  ${tries} tries: ${REWARD_STRUCTURE_PERCENT[tries]}% → ${reward} GC`);
        }
        
        // Test cheating penalty
        const penaltyPercent = CHEAT_PENALTY_PERCENT / 100;
        const penalty = Math.ceil(balance * penaltyPercent);
        console.log(`  Cheat penalty: ${CHEAT_PENALTY_PERCENT}% → -${penalty} GC`);
        console.log('');
    }

    console.log('📊 Key improvements:');
    console.log('  • Rewards scale with user wealth (no fixed inflation)');
    console.log('  • Rich players get bigger rewards but proportional to their wealth');
    console.log('  • Poor players get smaller but still meaningful rewards');
    console.log('  • Cheating penalty scales with wealth (bigger deterrent for wealthy)');
    console.log('  • Math.ceil ensures minimum 1 GC reward for any non-zero balance');
    console.log('');

    console.log('🎯 Economic benefits:');
    console.log('  • Total money creation now depends on player balances, not fixed amounts');
    console.log('  • Natural deflation as percentage rewards < 100%');
    console.log('  • Maintains excitement while controlling inflation');
}

testPercentageCalculations();