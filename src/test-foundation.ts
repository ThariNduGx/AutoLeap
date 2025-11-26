import { classifyIntent, selectModel } from './lib/core/smart-router';
import { estimateCost } from './lib/infrastructure/cost-tracker';

// Test the router
const testMessages = [
  'Hi there!',
  'Book AC cleaning for tomorrow',
  'How much does plumbing cost?',
  'Where is my technician?',
  'This service is terrible!',
];

console.log('=== INTENT CLASSIFICATION TEST ===');
testMessages.forEach((msg) => {
  const intent = classifyIntent(msg);
  const model = selectModel(intent);
  const estimate = estimateCost(model, msg, 150);
  
  console.log({
    message: msg,
    intent,
    model,
    estimatedCost: `$${estimate.estimatedCost.toFixed(6)}`,
  });
});