#!/usr/bin/env node

/**
 * Basic Node.js Application
 */

// Simple greeting function
function greet(name = 'World') {
  return `Hello, ${name}!`;
}

// Main function
function main() {
  console.log(greet());
  console.log('Welcome to this basic Node.js project!');
  console.log(`Node version: ${process.version}`);
}

// Run the application
if (require.main === module) {
  main();
}

// Export for testing
module.exports = { greet };
