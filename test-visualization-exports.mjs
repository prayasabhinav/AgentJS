#!/usr/bin/env node
/**
 * Test visualization exports
 */

console.log('🎨 Testing visualization exports...\n');

let testsPassedCount = 0;
let totalTestsCount = 0;

function runTest(testName, testFn) {
    totalTestsCount++;
    try {
        testFn();
        console.log(`✅ ${testName}`);
        testsPassedCount++;
    } catch (error) {
        console.log(`❌ ${testName}: ${error.message}`);
    }
}

// Test visualization exports
runTest('Visualizer class export', async () => {
    const { Visualizer } = await import('./dist/index.es.js');
    if (!Visualizer) {
        throw new Error('Visualizer not exported');
    }
});

runTest('AnimationEngine export', async () => {
    const { AnimationEngine } = await import('./dist/index.es.js');
    if (!AnimationEngine) {
        throw new Error('AnimationEngine not exported');
    }
});

runTest('Camera export', async () => {
    const { Camera } = await import('./dist/index.es.js');
    if (!Camera) {
        throw new Error('Camera not exported');
    }
});

runTest('HeatMapSystem export', async () => {
    const { HeatMapSystem } = await import('./dist/index.es.js');
    if (!HeatMapSystem) {
        throw new Error('HeatMapSystem not exported');
    }
});

runTest('ParticleEffectsSystem export', async () => {
    const { ParticleEffectsSystem } = await import('./dist/index.es.js');
    if (!ParticleEffectsSystem) {
        throw new Error('ParticleEffectsSystem not exported');
    }
});

// Wait for all tests to complete
setTimeout(() => {
    console.log(`\n📊 Test Results: ${testsPassedCount}/${totalTestsCount} tests passed`);
    
    if (testsPassedCount === totalTestsCount) {
        console.log('🎉 All visualization exports are working!');
        process.exit(0);
    } else {
        console.log('❌ Some visualization exports failed');
        process.exit(1);
    }
}, 100);