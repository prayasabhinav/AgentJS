#!/usr/bin/env node
/**
 * Test NetworkManager functionality
 */

import { NetworkManager, ConnectionType } from './dist/index.es.js';

console.log('🧪 Testing NetworkManager functionality...\n');

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

// Test 1: NetworkManager instantiation
runTest('NetworkManager instantiation', () => {
    const networkManager = new NetworkManager();
    if (!networkManager) {
        throw new Error('NetworkManager not created');
    }
});

// Test 2: Add connection
runTest('Add connection between agents', () => {
    const networkManager = new NetworkManager();
    const agent1 = 'agent1';
    const agent2 = 'agent2';
    
    const connection = networkManager.addConnection(
        agent1, 
        agent2, 
        ConnectionType.SUPPORTIVE, 
        0.8
    );
    
    if (!connection) {
        throw new Error('Connection not created');
    }
    
    if (connection.source !== agent1 || connection.target !== agent2) {
        throw new Error('Connection source/target incorrect');
    }
    
    if (connection.type !== ConnectionType.SUPPORTIVE) {
        throw new Error('Connection type incorrect');
    }
    
    if (connection.weight !== 0.8) {
        throw new Error('Connection weight incorrect');
    }
});

// Test 3: Check connection exists
runTest('Check connection exists', () => {
    const networkManager = new NetworkManager();
    const agent1 = 'agent1';
    const agent2 = 'agent2';
    
    networkManager.addConnection(agent1, agent2, ConnectionType.SUPPORTIVE);
    
    if (!networkManager.hasConnection(agent1, agent2)) {
        throw new Error('hasConnection returned false for existing connection');
    }
});

// Test 4: Get connections
runTest('Get agent connections', () => {
    const networkManager = new NetworkManager();
    const agent1 = 'agent1';
    const agent2 = 'agent2';
    const agent3 = 'agent3';
    
    networkManager.addConnection(agent1, agent2, ConnectionType.SUPPORTIVE);
    networkManager.addConnection(agent1, agent3, ConnectionType.ECONOMIC);
    
    const connections = networkManager.getConnections(agent1);
    
    if (connections.length !== 2) {
        throw new Error(`Expected 2 connections, got ${connections.length}`);
    }
});

// Test 5: Network analysis
runTest('Network analysis', () => {
    const networkManager = new NetworkManager();
    const agent1 = 'agent1';
    const agent2 = 'agent2';
    const agent3 = 'agent3';
    
    networkManager.addConnection(agent1, agent2, ConnectionType.SUPPORTIVE);
    networkManager.addConnection(agent2, agent3, ConnectionType.SUPPORTIVE);
    
    const analysis = networkManager.getNetworkAnalysis();
    
    if (analysis.nodeCount !== 3) {
        throw new Error(`Expected 3 nodes, got ${analysis.nodeCount}`);
    }
    
    if (analysis.edgeCount !== 2) {
        throw new Error(`Expected 2 edges, got ${analysis.edgeCount}`);
    }
});

// Test 6: Path finding
runTest('Path finding between agents', () => {
    const networkManager = new NetworkManager();
    const agent1 = 'agent1';
    const agent2 = 'agent2';
    const agent3 = 'agent3';
    
    networkManager.addConnection(agent1, agent2, ConnectionType.SUPPORTIVE);
    networkManager.addConnection(agent2, agent3, ConnectionType.SUPPORTIVE);
    
    const pathResult = networkManager.findPath(agent1, agent3);
    
    if (!pathResult.found) {
        throw new Error('Path not found');
    }
    
    if (pathResult.hops !== 2) {
        throw new Error(`Expected 2 hops, got ${pathResult.hops}`);
    }
    
    if (pathResult.path.length !== 3) {
        throw new Error(`Expected path length 3, got ${pathResult.path.length}`);
    }
});

// Test 7: Connection weight updates
runTest('Connection weight updates', () => {
    const networkManager = new NetworkManager();
    const agent1 = 'agent1';
    const agent2 = 'agent2';
    
    const connection = networkManager.addConnection(agent1, agent2, ConnectionType.SUPPORTIVE, 0.5);
    
    if (!connection) {
        throw new Error('Connection not created');
    }
    
    const updated = networkManager.strengthenConnection(agent1, agent2, 0.2);
    
    if (!updated) {
        throw new Error('Connection not updated');
    }
    
    const updatedConnection = networkManager.getConnection(agent1, agent2);
    
    if (!updatedConnection || updatedConnection.weight !== 0.7) {
        throw new Error(`Expected weight 0.7, got ${updatedConnection?.weight}`);
    }
});

console.log(`\n📊 Test Results: ${testsPassedCount}/${totalTestsCount} tests passed`);

if (testsPassedCount === totalTestsCount) {
    console.log('🎉 All NetworkManager tests passed!');
    process.exit(0);
} else {
    console.log('❌ Some NetworkManager tests failed');
    process.exit(1);
}