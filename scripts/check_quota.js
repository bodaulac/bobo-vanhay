#!/usr/bin/env node

import geminiService from '../src/lib/services/geminiService.js';

async function checkQuota() {
    console.log("📊 QUOTA STATUS CHECK");
    console.log("=" .repeat(50));
    
    // Get current quota status
    const quotaStatus = geminiService.getQuotaStatus();
    
    console.log("\n🔍 CURRENT STATUS:");
    console.log(`   • Status: ${quotaStatus.status.toUpperCase()}`);
    console.log(`   • Failed attempts: ${quotaStatus.failedAttempts}`);
    
    if (quotaStatus.status === 'exhausted') {
        console.log(`\n🚫 QUOTA EXHAUSTED:`);
        console.log(`   • Retry after: ${quotaStatus.retryAfterMinutes} minutes`);
        console.log(`   • Last check: ${quotaStatus.lastCheck}`);
        console.log(`   • Next check: ${quotaStatus.nextCheckTime}`);
        
        const timeLeftMs = quotaStatus.retryAfterMinutes * 60 * 1000;
        const nextCheck = new Date(Date.now() + timeLeftMs);
        console.log(`   • Will resume: ${nextCheck.toLocaleString()}`);
    } else {
        console.log(`\n✅ QUOTA AVAILABLE:`);
        console.log(`   • Last check: ${quotaStatus.lastCheck}`);
        console.log(`   • Ready for processing`);
    }
    
    // Get cost stats
    const costStats = geminiService.getCostStats();
    console.log("\n💰 COST STATISTICS:");
    console.log(`   • Total API calls: ${costStats.totalCalls}`);
    console.log(`   • Estimated cost: $${costStats.estimatedCost.toFixed(6)}`);
    console.log(`   • Avg cost/call: $${costStats.avgCostPerCall.toFixed(6)}`);
    console.log(`   • Est. cost/1000 stories: $${(costStats.avgCostPerCall * 1000).toFixed(2)}`);
    
    // Test connection if quota is available
    if (quotaStatus.status === 'available') {
        console.log("\n🔌 TESTING CONNECTION...");
        try {
            const connected = await geminiService.testConnection();
            if (connected) {
                console.log("✅ Connection test successful!");
            }
        } catch (error) {
            console.log("⚠️ Connection test skipped or failed");
        }
    }
    
    console.log("\n" + "=" .repeat(50));
    console.log("🎯 COMMANDS:");
    console.log("-" .repeat(30));
    console.log("• Reset quota: geminiService.resetQuota()");
    console.log("• Simulate quota error: geminiService.simulateQuotaExhaustion()");
    console.log("• Check status: geminiService.getQuotaStatus()");
    console.log("• Cost stats: geminiService.getCostStats()");
}

// Run check
checkQuota().catch(console.error);