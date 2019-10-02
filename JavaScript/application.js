'use strict';

// File contains a small piece of the source to demonstrate main module
// of a sample application to be executed in the sandboxed context by
// another pice of code from `framework.js`. Read README.md for tasks.

const fs = require('fs');
const net = require('net');
const crypto = require('crypto');

// Print from the global context of application module
console.log('From application global context');
console.dir({ fs, net }, { depth: 1 });
console.dir({ global }, { depth: 1 });
console.dir({ api }, { depth: 2 });

setTimeout(() => {
  console.log('setTimeout added to context');
}, 300);

let counter = 0;
const timer = setInterval(() => {
  console.log('setInterval added to context');
  counter++;
  if (counter > 3) clearInterval(timer);
}, 300);

require('util1');

module.exports = {
  log: () => {
    // Print from the exported function context
    console.log('From application exported function');
  },
  hash: crypto.createHash('sha256').digest('hex'),
};
