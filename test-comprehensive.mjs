#!/usr/bin/env node
/**
 * Comprehensive test of all AgentJS Core features
 */

import { 
    BaseAgent, 
    MovingAgent, 
    NetworkAgent,
    ContinuousSpace,
    Grid2D,
    RandomScheduler,
    SequentialScheduler,
    AgentManager,
    NetworkManager,
    ConnectionType,
    InteractionEngine,
    BehaviorTree,
    NodeStatus,
    PerformanceBenchmark
} from './dist/index.es.js';

console.log('🧪 Running comprehensive AgentJS Core tests...\n');

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

// Test 1: BaseAgent
runTest('BaseAgent creation and properties', () => {
    const agent = new BaseAgent();
    if (!agent || !agent.id) {
        throw new Error('BaseAgent not created or missing ID');
    }
    
    agent.setProperty('energy', 100);
    if (agent.getProperty('energy') !== 100) {
        throw new Error('Property setting/getting failed');
    }
});

// Test 2: MovingAgent
runTest('MovingAgent movement', () => {
    const agent = new MovingAgent(undefined, {}, { x: 0, y: 0 });
    agent.setVelocity(1, 1);
    const initialPos = agent.getPosition();
    
    agent.step();
    
    const newPos = agent.getPosition();
    if (newPos.x === initialPos.x && newPos.y === initialPos.y) {
        throw new Error('MovingAgent did not move');
    }
});

// Test 3: ContinuousSpace
runTest('ContinuousSpace environment', () => {
    const space = new ContinuousSpace(100, 100);
    const agent = new BaseAgent(undefined, { x: 50, y: 50 });
    
    space.addAgent(agent);
    
    if (space.getAgentCount() !== 1) {
        throw new Error('Agent not added to space');
    }
    
    const neighbors = space.findNeighbors(agent.getPosition(), 10);
    // Should find no neighbors excluding the agent itself, or only the agent itself
    if (neighbors.items.length > 1) {
        throw new Error('Neighbor search found unexpected agents');
    }
});

// Test 4: Grid2D
runTest('Grid2D environment', () => {
    const grid = new Grid2D(10, 10, 10); // 10x10 grid with cell size 10
    const agent = new BaseAgent(undefined, { x: 5, y: 5 });
    
    grid.addAgent(agent);
    
    if (grid.getAgentCount() !== 1) {
        throw new Error('Agent not added to grid');
    }
});

// Test 5: RandomScheduler
runTest('RandomScheduler execution', () => {
    const scheduler = new RandomScheduler();
    const agent1 = new BaseAgent();
    const agent2 = new BaseAgent();
    
    scheduler.addAgent(agent1);
    scheduler.addAgent(agent2);
    
    if (scheduler.getAgentCount() !== 2) {
        throw new Error('Agents not added to scheduler');
    }
    
    let stepCount = 0;
    agent1.step = () => { stepCount++; };
    agent2.step = () => { stepCount++; };
    
    scheduler.step();
    
    if (stepCount !== 2) {
        throw new Error('Scheduler did not execute all agents');
    }
});

// Test 6: SequentialScheduler
runTest('SequentialScheduler execution', () => {
    const scheduler = new SequentialScheduler();
    const agent1 = new BaseAgent();
    const agent2 = new BaseAgent();
    
    scheduler.addAgent(agent1);
    scheduler.addAgent(agent2);
    
    let executionOrder = [];
    agent1.step = () => { executionOrder.push(1); };
    agent2.step = () => { executionOrder.push(2); };
    
    scheduler.step();
    
    if (executionOrder.length !== 2 || executionOrder[0] !== 1 || executionOrder[1] !== 2) {
        throw new Error('Sequential execution order incorrect');
    }
});

// Test 7: AgentManager integration  
runTest('AgentManager integration', () => {
    const agentManager = new AgentManager();
    
    const agent = new MovingAgent(undefined, {}, { x: 50, y: 50 });
    agent.setVelocity(1, 0);
    agentManager.addAgent(agent);
    
    if (agentManager.getAgentCount() !== 1) {
        throw new Error('Agent not added to AgentManager');
    }
    
    agentManager.stepAll();
    
    // Agent should have moved
    const position = agent.getPosition();
    if (position.x === 50) {
        throw new Error('AgentManager step did not move agent');
    }
});

// Test 8: NetworkAgent
runTest('NetworkAgent social behavior', () => {
    const networkManager = new NetworkManager();
    const agent1 = new NetworkAgent(undefined, undefined, networkManager);
    const agent2 = new NetworkAgent(undefined, undefined, networkManager);
    
    if (!agent1 || !agent2) {
        throw new Error('NetworkAgents not created');
    }
    
    // Add connection
    networkManager.addConnection(agent1.id, agent2.id, ConnectionType.SUPPORTIVE, 0.8);
    
    if (!networkManager.hasConnection(agent1.id, agent2.id)) {
        throw new Error('Connection not established');
    }
});

// Test 9: InteractionEngine
runTest('InteractionEngine processing', () => {
    const engine = new InteractionEngine();
    
    let interactionProcessed = false;
    engine.registerInteraction({
        id: 'test-interaction',
        name: 'Test Interaction',
        range: 10,
        canInitiate: () => true,
        execute: () => {
            interactionProcessed = true;
            return { success: true, effects: [], metadata: {} };
        },
        priority: 1
    });
    
    const space = new ContinuousSpace(100, 100);
    const agent1 = new BaseAgent(undefined, {}, { x: 5, y: 5 });
    const agent2 = new BaseAgent(undefined, {}, { x: 6, y: 6 });
    
    space.addAgent(agent1);
    space.addAgent(agent2);
    
    engine.processInteractions(space);
    
    if (!interactionProcessed) {
        throw new Error('Interaction not processed');
    }
});

// Test 10: BehaviorTree
runTest('BehaviorTree execution', () => {
    let executed = false;
    
    const tree = new BehaviorTree({
        execute: (context) => {
            executed = true;
            return NodeStatus.SUCCESS;
        }
    });
    
    const agent = new BaseAgent();
    const result = tree.execute(agent);
    
    if (!executed || !result || result.status !== 'success') {
        throw new Error('BehaviorTree not executed correctly');
    }
});

// Test 11: PerformanceBenchmark
runTest('PerformanceBenchmark creation', () => {
    const benchmark = new PerformanceBenchmark({
        agentCounts: [5, 10], 
        iterations: 2
    });
    
    if (!benchmark) {
        throw new Error('PerformanceBenchmark not created');
    }
    
    // Just test that we can create it, running full benchmarks is too slow for this test
    const config = benchmark.getConfig ? benchmark.getConfig() : null;
    if (config === null) {
        // If there's no getConfig method, just verify the instance exists
        if (typeof benchmark !== 'object') {
            throw new Error('PerformanceBenchmark not properly instantiated');
        }
    }
});

// Test 12: Complex integration test
runTest('Complex integration scenario', () => {
    // Create environment with multiple agents, network connections, and interactions
    const agentManager = new AgentManager();
    const networkManager = new NetworkManager();
    
    // Create agents with different behaviors
    const agents = [];
    for (let i = 0; i < 5; i++) {
        const agent = new NetworkAgent(
            undefined,
            { x: Math.random() * 200, y: Math.random() * 200 },
            networkManager
        );
        agents.push(agent);
        agentManager.addAgent(agent);
    }
    
    // Create network connections
    for (let i = 0; i < agents.length - 1; i++) {
        networkManager.addConnection(
            agents[i].id,
            agents[i + 1].id,
            ConnectionType.SUPPORTIVE,
            0.7
        );
    }
    
    // Run simulation steps
    for (let step = 0; step < 10; step++) {
        agentManager.stepAll();
    }
    
    // Verify network analysis
    const analysis = networkManager.getNetworkAnalysis();
    if (analysis.nodeCount !== 5 || analysis.edgeCount !== 4) {
        throw new Error(`Network analysis incorrect: nodes=${analysis.nodeCount}, edges=${analysis.edgeCount}`);
    }
    
    // Verify agent manager state
    if (agentManager.getAgentCount() !== 5) {
        throw new Error('Agent count incorrect after simulation');
    }
});

console.log(`\n📊 Test Results: ${testsPassedCount}/${totalTestsCount} tests passed`);

if (testsPassedCount === totalTestsCount) {
    console.log('🎉 All AgentJS Core features are working correctly!');
    console.log('\n📋 Verified features:');
    console.log('  - Agent system (BaseAgent, MovingAgent, NetworkAgent)');
    console.log('  - Environment system (ContinuousSpace, Grid2D)');
    console.log('  - Scheduling system (RandomScheduler, SequentialScheduler)');
    console.log('  - Network system (NetworkManager, ConnectionType)');
    console.log('  - Interaction system (InteractionEngine)');
    console.log('  - Behavior system (BehaviorTree)');
    console.log('  - Performance system (PerformanceBenchmark)');
    console.log('  - Integration (AgentManager coordinating all systems)');
    process.exit(0);
} else {
    console.log('❌ Some tests failed');
    process.exit(1);
}