import { executeRun } from './monte-carlo.js';
let started = false;
self.onmessage = async event => {
  if (started || event.data?.type !== 'start') return;
  started = true;
  const config = event.data.config;
  try {
    const result = await executeRun(config, {
      progress: completed => self.postMessage({ type: 'progress', runId: config.runId, completed }),
      // Worker yielding permits messages without blocking the document.
      yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)),
      blockSize: 1024,
    });
    self.postMessage({ type: 'complete', runId: config.runId, result });
  } catch (error) {
    self.postMessage({ type: 'error', runId: config?.runId, message: error.message });
  }
};
self.postMessage({ type: 'ready' });
