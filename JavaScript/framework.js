'use strict';

// Example showing us how the framework creates an environment (sandbox) for
// appication runtime, load an application code and passes a sandbox into app
// as a global context and receives exported application interface

const PARSING_TIMEOUT = 1000;
const EXECUTION_TIMEOUT = 5000;

// The framework can require core libraries
const fs = require('fs');
const vm = require('vm');
const timers = require('timers');
const events = require('events');

// Create a hash and turn it into the sandboxed context which will be
// the global context of an application
const context = {
  module: {}, console, setTimeout, setInterval, clearInterval,
  require: name => {
    if (name === 'fs') {
      console.log('Module fs is restricted');
      return null;
    }
    let util;
    try {
      util = require(`./utils/${name}`);
    } catch (e) {
      util = require(name);
    }
    console.log(`required ${name}`);
    return util;
  }
};

context.global = context;

const sandbox = vm.createContext(context);

const contextBefore = context;

// Prepare lambda context injection
const api = { timers,  events };

// Read an application source code from the file
const args = process.argv.slice(2);
let appName = args[0];
let fileName = '';
if (appName) {
  if (appName.indexOf('.js') === -1) {
    let files;
    try {
      files = fs.readdirSync(`./${appName}`, { withFileTypes: true, });
      fileName = `./${appName}/index.js`;
    } catch (e) {
      fileName = `${appName}.js`;
      files = fs.readFileSync(`./${fileName}`);
      if (!files) {
        fileName = './application.js';
      }
    }
  } else {
    fs.readdirSync(`./${appName}`, { withFileTypes: true, });
  }
} else {
  fileName = './application.js';
  appName = 'application';
}

// Intercept console.log
const logger = context.console.log;
context.console.log = (...args) => {
  const time = new Date();
  const message = [...args].join(' ');
  const logMessage = `${appName} ${time.toISOString()} ${message}`;
  logger(logMessage);
  fs.appendFile('log.txt', `${logMessage}\n`, (err) => {
    if (err) throw err;
  });
};

fs.readFile(fileName, 'utf8', (err, src) => {
  // We need to handle errors here

  // Wrap source to lambda, inject api
  src = `api => { ${src} };`;

  // Run an application in sandboxed context
  let script;
  try {
    script = new vm.Script(src, { timeout: PARSING_TIMEOUT });
  } catch (e) {
    console.dir(e);
    console.log('Parsing timeout');
    process.exit(1);
  }

  try {
    const f = script.runInNewContext(sandbox, { timeout: EXECUTION_TIMEOUT });
    f(api);
    const exported = sandbox.module.exports;
    const result = {};
    for (const exp in exported) {
      if (Object.prototype.hasOwnProperty.call(exported, exp)) {
        const type = typeof exported[exp];

        result[exp] = {
          data: exported[exp],
          type,
        };
        if (type === 'function') {
          result[exp].argsLength = exported[exp].length;
          result[exp].code = exported[exp] + '';
        }
      }
    }
    console.dir({ exported: result });

    // Check the context changing
    const contextAfter = exported.global;
    console.dir({ contextBefore }, { depth: 2 });
    console.dir({ contextAfter }, { depth: 2 });

    const beforeContextKeys = Object.keys(contextBefore);
    const afterContextKeys = Object.keys(contextAfter);
    const difference = {
      deleted: [],
      added: [],
    };
    for (let i = 0, length = beforeContextKeys.length; i < length; i++) {
      if (afterContextKeys.indexOf(beforeContextKeys[i]) === -1) {
        difference.deleted.push(beforeContextKeys[i]);
      }
    }
    for (let i = 0, length = afterContextKeys.length; i < length; i++) {
      if (beforeContextKeys.indexOf(afterContextKeys[i]) === -1) {
        difference.added.push(afterContextKeys[i]);
      }
    }
    if (!difference.added.length && !difference.deleted.length) {
      console.log('Context was not changed');
    } else {
      console.dir({ difference }, { depth: 2 });
    }
  } catch (e) {
    console.dir(e);
    console.log('Execution timeout');
    process.exit(1);
  }

  // We can access a link to exported interface from sandbox.module.exports
  // to execute, save to the cache, print to console, etc.
});

process.on('uncaughtException', err => {
  console.log('Unhandled exception: ' + err);
});
