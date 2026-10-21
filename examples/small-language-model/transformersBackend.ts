/**
 * SmallLMBackend built on transformers.js (ONNX Runtime), which runs in the
 * browser (WASM or WebGPU) and in Node.js. Install it next to agentjs-core:
 *
 *   npm install @huggingface/transformers
 *
 * Any Hugging Face model with an onnx/ folder works, e.g.
 * HuggingFaceTB/SmolLM2-135M-Instruct or onnx-community/Qwen2.5-0.5B-Instruct.
 */

import type { SmallLMBackend } from './SmallLanguageModel';

export interface TransformersBackendOptions {
  /** Weight precision; q4 is the smallest download, fp32 the most accurate */
  dtype?: 'fp32' | 'fp16' | 'q8' | 'int8' | 'uint8' | 'q4' | 'q4f16' | 'bnb4';

  /** 'webgpu' in supporting browsers, otherwise the default WASM/CPU */
  device?: 'webgpu' | 'wasm' | 'cpu';
}

function logSumExp(values: number[]): number {
  const max = Math.max(...values);
  return max + Math.log(values.reduce((sum, v) => sum + Math.exp(v - max), 0));
}

export async function createTransformersBackend(
  modelId: string,
  options: TransformersBackendOptions = {}
): Promise<SmallLMBackend> {
  const { AutoTokenizer, AutoModelForCausalLM } = await import('@huggingface/transformers');

  const tokenizer = await AutoTokenizer.from_pretrained(modelId);
  const model = await AutoModelForCausalLM.from_pretrained(modelId, {
    dtype: options.dtype ?? 'q4',
    ...(options.device ? { device: options.device } : {})
  });

  const chatInputs = (prompt: string) => {
    const text = tokenizer.apply_chat_template([{ role: 'user', content: prompt }], {
      tokenize: false,
      add_generation_prompt: true
    }) as string;
    return tokenizer(text);
  };

  // First token of each spelling a model might start its answer with
  const firstTokens = new Map<string, number[]>();
  const tokensFor = (choice: string): number[] => {
    let ids = firstTokens.get(choice);
    if (!ids) {
      const spellings = [choice, choice[0]!.toUpperCase() + choice.slice(1)];
      ids = [...new Set(spellings.map(s => tokenizer.encode(s, { add_special_tokens: false })[0]!))];
      firstTokens.set(choice, ids);
    }
    return ids;
  };

  return {
    // One forward pass: compare next-token logits of each choice's first token
    async rankChoices(prompt, choices) {
      const tokenLists = choices.map(tokensFor);
      const seen = new Set<number>();
      for (const id of tokenLists.flat()) {
        if (seen.has(id)) {
          throw new Error(`Choices ${choices.join(', ')} share a first token for ${modelId}; rename one`);
        }
        seen.add(id);
      }

      const { logits } = await model(chatInputs(prompt));
      const [, length, vocab] = logits.dims as [number, number, number];
      const last = (logits.data as Float32Array).subarray((length - 1) * vocab, length * vocab);
      return tokenLists.map(ids => logSumExp(ids.map(id => last[id]!)));
    },

    async generate(prompt, maxNewTokens) {
      const inputs = chatInputs(prompt);
      const output = (await model.generate({ ...inputs, max_new_tokens: maxNewTokens, do_sample: false })) as any;
      const promptLength = inputs.input_ids.dims[1];
      const newTokens = output.slice(null, [promptLength, null]);
      return tokenizer.batch_decode(newTokens, { skip_special_tokens: true })[0] ?? '';
    },

    dispose() {
      void model.dispose();
    }
  };
}
