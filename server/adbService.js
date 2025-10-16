'use strict';

const { spawn } = require('child_process');

const DEFAULT_TIMEOUT = Number(process.env.ADB_COMMAND_TIMEOUT ?? 5000);
const adbExecutable = process.env.ADB_PATH || 'adb';

function runAdbCommand(args, options = {}) {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const serial = options.serial?.trim();
  const finalArgs = serial ? ['-s', serial, ...args] : args;

  return new Promise((resolve, reject) => {
    const adb = spawn(adbExecutable, finalArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      adb.kill();
      reject(new Error(`ADB command timed out: ${args.join(' ')}`));
    }, timeout);

    adb.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    adb.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    adb.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    adb.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
      } else {
        const message = stderr.trim() || stdout.trim();
        reject(new Error(message || `ADB exited with code ${code}`));
      }
    });
  });
}

async function connect(host) {
  if (!host) {
    throw new Error('Missing host to connect.');
  }

  const { stdout, stderr } = await runAdbCommand(['connect', host], { timeout: 10000 });
  const message = stdout || stderr;
  const connected = /connected to/.test(message);
  return { message, connected };
}

async function disconnect(host) {
  const args = host ? ['disconnect', host] : ['disconnect'];
  const { stdout, stderr } = await runAdbCommand(args);
  return { message: stdout || stderr };
}

async function getDevices() {
  const { stdout } = await runAdbCommand(['devices']);
  const lines = stdout.split('\n').slice(1).map((line) => line.trim()).filter(Boolean);

  return lines.map((line) => {
    const [serial, state] = line.split('\t');
    return {
      serial,
      state: state || 'unknown',
      isEmulator: /^emulator-/.test(serial),
    };
  });
}

async function sendKeyevent(key, serial) {
  if (!key) {
    throw new Error('Key event is required.');
  }

  const sanitized = key.toUpperCase();
  await runAdbCommand(['shell', 'input', 'keyevent', sanitized], { serial });
  return { message: `Sent ${sanitized}` };
}

async function sendKeyeventSequence(keys, delayMs = 120, serial) {
  for (const key of keys) {
    await sendKeyevent(key, serial);
    // give the device a brief pause between key events so commands do not overlap
    await delay(delayMs);
  }
  return { message: `Sent sequence ${keys.join(', ')}` };
}

async function inputText(text, serial) {
  if (text == null) {
    throw new Error('Text is required.');
  }

  const safeText = String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\s/g, '%s');

  await runAdbCommand(['shell', 'input', 'text', safeText], { serial });
  return { message: 'Text input sent' };
}

async function shell(commandArgs, options = {}) {
  if (!Array.isArray(commandArgs) || commandArgs.length === 0) {
    throw new Error('Shell command arguments are required.');
  }

  return runAdbCommand(['shell', ...commandArgs], options);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  connect,
  disconnect,
  getDevices,
  sendKeyevent,
  sendKeyeventSequence,
  inputText,
  shell,
};
