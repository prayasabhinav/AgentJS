# AgentJS Core Framework

[![npm version](https://badge.fury.io/js/agentjs-core.svg)](https://www.npmjs.com/package/agentjs-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2%2B-blue)](https://www.typescriptlang.org/)

A powerful, TypeScript-first agent-based modeling framework with built-in p5.js visualization, designed for creating interactive simulations, social impact games, and educational experiences.

## 🎯 Description

AgentJS Core is a comprehensive framework for building agent-based models (ABMs) in the browser or Node.js. It provides a robust foundation for simulating complex systems through autonomous agents that interact within defined environments. Whether you're modeling social networks, ecological systems, economic markets, or creating educational games about social dynamics, AgentJS Core offers the tools you need.

### Key Features

- 🤖 **Flexible Agent System** - Create diverse agent types with customizable behaviors
- 🌍 **Multiple Environment Types** - Grid-based and continuous space environments
- 🎨 **Built-in Visualization** - p5.js-powered rendering with camera controls and effects
- 🧠 **ML Integration** - TensorFlow.js support for intelligent agent behaviors
- 🔢 **NSMnum** - each agent type run by its own small model, which answers only with the number of an action from a list or none, trained on your own keys ([NSMnum syntax](https://syntax.prayasabhinav.net/nsmnum/))
- 📊 **Data Analysis** - Comprehensive metrics collection and export capabilities
- ⚙️ **JSON Configuration** - Define complete simulations via JSON configuration files
- 🎮 **Game-Ready** - Designed for educational games and interactive simulations
- 📦 **TypeScript First** - Full type safety and excellent IDE support
- ⚡ **Performance Optimized** - Spatial indexing, object pooling, and efficient scheduling

## 🚀 Quick Start

### Installation

```bash
npm install agentjs-core p5
```

Note: p5.js is a peer dependency and must be installed separately.

### Basic Example

```typescript
import { BaseAgent, ContinuousSpace, AgentManager, RandomScheduler } from 'agentjs-core';

// Create a simple agent that moves randomly
class RandomWalker extends BaseAgent {
  constructor(id) {
    super(id);
    this.setProperty('x', Math.random() * 500);
    this.setProperty('y', Math.random() * 500);
    this.setProperty('speed', 2);
  }

  step() {
    const angle = Math.random() * Math.PI * 2;
    const dx = Math.cos(angle) * this.getProperty('speed');
    const dy = Math.sin(angle) * this.getProperty('speed');
    
    this.setProperty('x', this.getProperty('x') + dx);
    this.setProperty('y', this.getProperty('y') + dy);
  }
}

// Set up the simulation
const environment = new ContinuousSpace(500, 500);
const scheduler = new RandomScheduler();
const manager = new AgentManager(environment, scheduler);

// Add agents
for (let i = 0; i < 100; i++) {
  const agent = new RandomWalker(`walker-${i}`);
  manager.addAgent(agent);
}

// Run simulation steps
function animate() {
  manager.step();
  requestAnimationFrame(animate);
}
animate();
```

## 📚 Use Cases

### Educational Simulations
Create interactive lessons about complex systems:
- **Ecosystem Dynamics** - Model predator-prey relationships, food webs
- **Disease Spread** - Simulate epidemics and intervention strategies
- **Traffic Flow** - Demonstrate emergence in transportation systems
- **Economic Markets** - Show supply/demand, market dynamics

### Social Impact Games
Build games that explore social issues:
- **Network Effects** - Model social influence and information spread
- **Resource Management** - Simulate tragedy of the commons scenarios
- **Community Building** - Explore cooperation vs. competition dynamics
- **System Intervention** - Test policies and their cascading effects

### Research & Analysis
Conduct computational experiments:
- **Behavioral Studies** - Test hypotheses about agent interactions
- **Policy Testing** - Evaluate intervention strategies
- **Pattern Discovery** - Identify emergent phenomena
- **Data Generation** - Create synthetic datasets for ML training

### Interactive Art
Create generative and responsive experiences:
- **Flocking Behaviors** - Beautiful emergent patterns
- **Particle Systems** - Dynamic visual effects
- **Generative Landscapes** - Evolving virtual worlds
- **Interactive Installations** - Responsive to user input

## 💻 Detailed Usage

### Creating Custom Agents

```typescript
import { MovingAgent, NetworkAgent } from 'agentjs-core';

// Agent with movement capabilities
class Predator extends MovingAgent {
  constructor(id) {
    super(id);
    this.setProperty('huntingRange', 50);
    this.setProperty('energy', 100);
  }

  step() {
    // Find nearest prey
    const neighbors = this.environment.getNeighbors(this, this.getProperty('huntingRange'));
    const prey = neighbors.find(n => n instanceof Prey);
    
    if (prey) {
      // Move toward prey
      this.moveToward(prey.getProperty('x'), prey.getProperty('y'));
    } else {
      // Random walk
      this.randomWalk();
    }
    
    // Decrease energy
    this.setProperty('energy', this.getProperty('energy') - 1);
  }
}

// Agent with social network capabilities
class SocialAgent extends NetworkAgent {
  constructor(id) {
    super(id);
    this.setProperty('influence', Math.random());
    this.setProperty('opinion', Math.random());
  }

  step() {
    // Get connected agents
    const connections = this.getConnections();
    
    if (connections.length > 0) {
      // Average opinions of connected agents
      const avgOpinion = connections.reduce((sum, agent) => 
        sum + agent.getProperty('opinion'), 0) / connections.length;
      
      // Update own opinion based on social influence
      const currentOpinion = this.getProperty('opinion');
      const newOpinion = currentOpinion * 0.9 + avgOpinion * 0.1;
      this.setProperty('opinion', newOpinion);
    }
  }
}
```

### Visualization with p5.js

```typescript
import { Visualizer, Camera, HeatMapSystem } from 'agentjs-core';
import p5 from 'p5';

const sketch = (p: p5) => {
  let visualizer: Visualizer;
  let camera: Camera;
  let heatmap: HeatMapSystem;

  p.setup = () => {
    p.createCanvas(800, 600);
    
    // Initialize visualization components
    visualizer = new Visualizer(manager, {
      canvas: { width: 800, height: 600 },
      agents: {
        defaultSize: 5,
        colorProperty: 'energy', // Color agents by energy level
        showLabels: false
      }
    });
    
    camera = new Camera(p);
    heatmap = new HeatMapSystem(p, 800, 600, 20);
  };

  p.draw = () => {
    p.background(255);
    
    // Apply camera transformations
    camera.apply();
    
    // Render heatmap
    heatmap.update(manager.getAllAgents());
    heatmap.render();
    
    // Render agents
    visualizer.render(p);
    
    camera.reset();
    
    // Step simulation
    manager.step();
  };

  // Camera controls
  p.mouseWheel = (event: WheelEvent) => {
    camera.zoom(event.deltaY * 0.001);
  };

  p.mouseDragged = () => {
    if (p.mouseIsPressed) {
      camera.pan(p.mouseX - p.pmouseX, p.mouseY - p.pmouseY);
    }
  };
};

new p5(sketch);
```

### Machine Learning Integration

```typescript
import { MLAgent, ModelRegistry, StateEncoder } from 'agentjs-core';
import * as tf from '@tensorflow/tfjs';

// Create an ML-enhanced agent
class SmartAgent extends MLAgent {
  constructor(id, model) {
    super(id, model);
    this.encoder = new StateEncoder(['x', 'y', 'energy', 'nearestThreat']);
  }

  async step() {
    // Encode current state
    const state = this.encoder.encode(this.getProperties());
    
    // Get action from model
    const action = await this.predictAction(state);
    
    // Execute action
    this.executeAction(action);
    
    // Store experience for training
    const reward = this.calculateReward();
    this.storeExperience(state, action, reward);
  }
}

// Register and use models
const registry = new ModelRegistry();
await registry.loadModel('smart-agent', '/models/smart-agent.json');

const agent = new SmartAgent('agent-1', registry.getModel('smart-agent'));
```

### NSMnum: each agent type run by its own small model

An NSMnum, Narrow Small Model (numerating), said en-ess-em-num, is a small model that answers only with a number: the place of one action in a fixed list, or none. It writes no text and does not act: your code checks each answer and decides what runs. The method is called ungli ([repository](https://github.com/koherarchitecture/ungli)); the parts of an NSMnum are listed on its page on SYNTAX ([NSMnum syntax](https://syntax.prayasabhinav.net/nsmnum/)).

In AgentJS each agent type can have its own NSMnum. A table in your code gives each type a row: its NSMnum, its list of actions, and the action it takes when the answer is none (its "don't know").

```typescript
import { MLAgent, NSMnumTable, TensorFlowChooser } from 'agentjs-core';
import type { AgentAction, MLAgentState } from 'agentjs-core';

class Reader extends MLAgent {}
class Walker extends MLAgent {}

const actions: AgentAction[] = [
  { type: 'MOVE', parameters: { dx: 1, dy: 0 } },    // place 0: right
  { type: 'MOVE', parameters: { dx: -1, dy: 0 } },   // place 1: left
];
const wait: AgentAction = { type: 'CHANGE_PROPERTY', parameters: { property: 'waiting', value: 1 } };
const encode = (state: MLAgentState) => [state.properties.energy ?? 0];   // turns a state into the numbers the model reads

// an untrained chooser answers almost at random; train it on your keys (below)
const readerChooser = new TensorFlowChooser(TensorFlowChooser.create(1, actions.length), encode, 0.6);
const walkerChooser = new TensorFlowChooser(TensorFlowChooser.create(1, actions.length), encode, 0.6);

const table = new NSMnumTable([
  { agentType: Reader, model: readerChooser, actions, none: wait },
  { agentType: Walker, model: walkerChooser, actions, none: wait,
    allowed: (state, place) => state.position.x > 0 || place === 0 },   // at x ≤ 0, only place 0 (right) is allowed
]);
const readers = [new Reader(), new Reader()], walkers = [new Walker()];
const uncovered = await table.assign([...readers, ...walkers]);   // agents no row covers come back to you
```

In code, places count from 0: `actions[0]` is place 0. An answer counts as none when it is not a whole number from 0 to `actions.length - 1`, when `allowed` returns false, or when the model throws; on none, the agent runs the row's `none` action. Rows match with `instanceof`, and the first row an agent matches is its row, so put subclasses before the classes they extend.

`TensorFlowChooser.create(inputs, actions.length)` makes a small TensorFlow.js model with one output per action and a last one for none; `new TensorFlowChooser(model, encode, threshold)` wraps it as an NSMnum. An answer whose highest output (a softmax probability) is below the threshold counts as none; with a threshold of 0, the default, no answer is refused this way. Choose the threshold by checking the chooser's answers on keyed situations you left out of training.

**The table in JSON.** Rows can be written in the same JSON file as the rest of a simulation, under `nsmnum`, and then match agents by their `kind` property instead of by class:

```json
{
  "nsmnum": [
    {
      "kind": "literal",
      "model": "models/literal/model.json",
      "reads": ["distance", "concreteness"],
      "actions": [
        { "type": "MOVE", "parameters": { "dx": 1, "dy": 0 } },
        { "type": "MOVE", "parameters": { "dx": -1, "dy": 0 } }
      ],
      "none": { "type": "CHANGE_PROPERTY", "parameters": { "property": "waiting", "value": 1 } },
      "threshold": 0.6
    }
  ]
}
```

```typescript
import fs from 'node:fs';
import { tableFromJSON } from 'agentjs-core';

const config = JSON.parse(fs.readFileSync('simulation.json', 'utf8'));
const table = await tableFromJSON(config.nsmnum);   // a browser fetches each model file
await table.assign(agents);                         // agents with properties like { kind: 'literal', distance: 0.2, concreteness: 0.8 }
```

`reads` names the numeric properties the model reads, in order; an agent missing one of them gets none. Every row is checked before anything loads, and each model must read as many numbers as `reads` names and give one output per action plus one for none; otherwise the table is not built and the error names the row. A row that needs an `allowed` check must be written in code, not JSON.

A model file is a trained chooser saved with TensorFlow.js: `await chooser.model.save('downloads://literal')` in a browser, or, in Node with `@tensorflow/tfjs-node` installed, `await chooser.model.save('file://models/literal')` and the loader `(path) => tf.loadLayersModel('file://' + path)` as `tableFromJSON`'s second argument. To key and train for a JSON row, write the `encode` it uses: its `reads`, in order, `(state) => row.reads.map((name) => state.properties[name])`.

**Train an NSMnum on your keys and nothing else.** A key is your answer for one situation: the number of the action you would have the agent take, or 0 for none. You give keys on a blind sheet, which shows each situation with no model's answer on it. The package ships no keys: you key your own, and the keys stay in a file on your machine.

These steps use `keyingItems`, `readKeys` and `keyedRows` from `agentjs-core`, and Node's `fs`. Each agent type has its own NSMnum, so keep its situations, its sheet, its keys file and its training apart from every other type's.

1. During a run, after each step, keep situations for the type: ``{ id: `${agent.id}-${step}`, state: agent.getCurrentState() }``. Each id must be unique: the keyer skips an id it has seen, and `readKeys` keeps only the latest key for it.
2. Write the sheet: `fs.writeFileSync('sheet.json', JSON.stringify(keyingItems(situations, ['right', 'left'])))`. Each item shows the agent's position, each of its numeric properties (except the four MLAgent keeps about its own model: `mlEnabled`, `predictionConfidence`, `fallbackMode`, `errorRate`) and its number of neighbours, then the actions numbered from 1, with 0 for none.
3. Key it in a terminal:

```bash
npx agentjs-key sheet.json my.keys.jsonl
```

   Type the number of the action you would choose, 0 for none, s to skip, q to stop. Run it again later and it shows only the situations not yet keyed, skipped ones included. If your project is in git, add `*.keys.jsonl` to its `.gitignore`.
4. Read the keys back and train:

```typescript
const { keys, unread } = readKeys(fs.readFileSync('my.keys.jsonl', 'utf8'), actions.length);
await readerChooser.train(keyedRows(situations, keys, encode), actions.length);
```

On the sheet, actions are numbered from 1 and 0 means none; `readKeys` turns them into places counted from 0. A key outside the list is not used, and its item's id comes back in `unread`. `keyedRows` needs the same situations you wrote the sheet from; if you key in a later session, save each `id` with `encode(state)` beside the sheet and pass `{ id, features, place }` rows to `train` yourself. Train an NSMnum only on keys, never on its own answers or on a run's outcomes.

`test-nsmnum.mjs` checks this behaviour against the built package; after `npm run build`, `npm test` runs it.

### JSON Configuration System

AgentJS Core features a powerful JSON configuration system that allows you to define entire simulations without writing code. Perfect for non-programmers, rapid prototyping, and sharing reproducible experiments.

```typescript
import { ConfigurationManager, SimulationController } from 'agentjs-core';

// Load simulation from JSON configuration
const config = {
  "simulation": {
    "name": "Flocking Behavior",
    "steps": 1000,
    "environment": {
      "type": "continuous",
      "width": 800,
      "height": 600,
      "boundaryType": "periodic"
    }
  },
  "agents": [
    {
      "type": "FlockingAgent",
      "count": 100,
      "properties": {
        "speed": { "min": 2, "max": 4 },
        "visionRadius": 50,
        "separationRadius": 25,
        "cohesionStrength": 0.05,
        "alignmentStrength": 0.05,
        "separationStrength": 0.15
      }
    }
  ],
  "visualization": {
    "frameRate": 60,
    "agentSize": 3,
    "showTrails": true,
    "trailLength": 20,
    "colorScheme": "velocity"
  },
  "data": {
    "collectEvery": 10,
    "metrics": ["averageSpeed", "clusterCount", "polarization"],
    "export": {
      "format": "csv",
      "filename": "flocking-data.csv"
    }
  }
};

// Initialize and run simulation
const manager = new ConfigurationManager();
const simulation = manager.loadConfiguration(config);
const controller = new SimulationController(simulation);

// Run with automatic data collection
controller.run({
  onStep: (step, metrics) => console.log(`Step ${step}:`, metrics),
  onComplete: (results) => console.log('Simulation complete:', results)
});
```

#### ML Model Configuration

```json
{
  "ml": {
    "models": [
      {
        "name": "predator-brain",
        "type": "reinforcement",
        "architecture": {
          "inputSize": 8,
          "hiddenLayers": [64, 32],
          "outputSize": 4,
          "activation": "relu"
        },
        "training": {
          "episodes": 1000,
          "batchSize": 32,
          "learningRate": 0.001,
          "rewardFunction": "custom"
        }
      }
    ],
    "agentMapping": {
      "Predator": "predator-brain"
    }
  }
}
```

#### Parameter Sweeps

```typescript
import { ParameterTuner } from 'agentjs-core';

// Define parameter sweep configuration
const sweepConfig = {
  "baseConfig": "configs/base-simulation.json",
  "parameters": [
    {
      "path": "agents[0].properties.speed",
      "values": [1, 2, 3, 4, 5]
    },
    {
      "path": "agents[0].properties.visionRadius", 
      "range": { "min": 20, "max": 100, "step": 20 }
    }
  ],
  "repetitions": 5,
  "parallel": true
};

// Run parameter sweep
const tuner = new ParameterTuner();
const results = await tuner.sweep(sweepConfig);

// Analyze results
console.log('Optimal parameters:', results.optimal);
console.log('Parameter sensitivity:', results.sensitivity);
```

### Data Collection & Analysis

```typescript
import { DataCollector, StatisticsEngine, ExportManager } from 'agentjs-core';

// Set up data collection
const collector = new DataCollector(manager);
collector.addMetric('averageEnergy', () => {
  const agents = manager.getAllAgents();
  const totalEnergy = agents.reduce((sum, a) => sum + a.getProperty('energy'), 0);
  return totalEnergy / agents.length;
});

collector.addMetric('clusterCount', () => {
  // Custom clustering analysis
  return countClusters(manager.getAllAgents());
});

// Run simulation and collect data
for (let step = 0; step < 1000; step++) {
  manager.step();
  collector.collect(step);
}

// Analyze results
const stats = new StatisticsEngine(collector.getData());
console.log('Mean energy:', stats.mean('averageEnergy'));
console.log('Energy std dev:', stats.standardDeviation('averageEnergy'));
console.log('Correlation:', stats.correlation('averageEnergy', 'clusterCount'));

// Export data
const exporter = new ExportManager(collector);
exporter.toCSV('/data/simulation-results.csv');
exporter.toJSON('/data/simulation-results.json');
```

## 📖 Documentation

### Core Concepts

- **Agents**: Autonomous entities with properties and behaviors
- **Environment**: Spatial context where agents exist and interact
- **Scheduler**: Controls agent activation order (random, sequential, etc.)
- **Manager**: Coordinates agents, environment, and scheduling
- **Behaviors**: Reusable action patterns (via behavior trees)
- **Networks**: Agent relationships and social connections
- **Visualization**: Real-time rendering of agent states and interactions
- **Configuration**: JSON-based simulation definitions for code-free modeling
- **Parameter Tuning**: Automated exploration of parameter spaces

### API Reference

Full API documentation is available at: [GitHub Wiki](https://github.com/anti-games-project/AgentJS/wiki)

## 🛠️ Development

### Setup

```bash
# Clone the repository
git clone https://github.com/anti-games-project/AgentJS.git
cd AgentJS

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Project Structure

```
src/
├── core/           # Core agent and simulation systems
├── environment/    # Spatial environments
├── behaviors/      # Behavior trees and actions
├── network/        # Social network functionality
├── visualization/  # p5.js rendering components
├── analysis/       # Data collection and statistics
├── ml/            # Machine learning integration
└── utils/         # Utility functions
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📚 Examples

Check out the `/examples` directory for complete working examples:

- `flocking-simulation.ts` - Classic boids flocking behavior
- `ecosystem.ts` - Predator-prey ecosystem

## 🚧 Roadmap

- [ ] WebGPU acceleration for massive simulations
- [ ] 3D visualization with Three.js
- [ ] Network analysis toolkit
- [ ] Visual programming interface
- [ ] Cloud simulation runner
- [ ] Python bindings
- [ ] Unity integration

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Built with [p5.js](https://p5js.org/) for visualization
- ML features powered by [TensorFlow.js](https://www.tensorflow.org/js)
- Inspired by [NetLogo](https://ccl.northwestern.edu/netlogo/) and [Mesa](https://mesa.readthedocs.io/)

## 📮 Contact

- Issues: [GitHub Issues](https://github.com/anti-games-project/AgentJS/issues)
- Discussions: [GitHub Discussions](https://github.com/anti-games-project/AgentJS/discussions)
- Email: me@prayas.in

---

**AgentJS Core** - Empowering developers to model complex systems and create impactful simulations 🚀
