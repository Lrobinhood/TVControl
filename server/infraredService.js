'use strict';

const adbService = require('./adbService');

const INFRARED_ENABLE_PATH = '/sys/class/remote/amremote/enable';
const PERMISSION_DENIED_PATTERN = /(permission denied|operation not permitted|not allowed|must be root|need root)/i;
const CUSTOM_DISABLE_COMMAND = process.env.INFRARED_DISABLE_COMMAND?.trim();
const CUSTOM_ENABLE_COMMAND = process.env.INFRARED_ENABLE_COMMAND?.trim();
const CUSTOM_READ_COMMAND = process.env.INFRARED_READ_COMMAND?.trim();
const WRITE_VERIFICATION_RETRIES = Number(process.env.INFRARED_VERIFY_ATTEMPTS ?? 6);
const WRITE_VERIFICATION_DELAY = Number(process.env.INFRARED_VERIFY_DELAY ?? 200);

const DEFAULT_DISABLE_COMMAND = `echo 0 > ${INFRARED_ENABLE_PATH}`;
const DEFAULT_ENABLE_COMMAND = `echo 1 > ${INFRARED_ENABLE_PATH}`;
const DEFAULT_READ_COMMAND = `cat ${INFRARED_ENABLE_PATH}`;

function buildShellCommand(command, fallback) {
  const resolved = command && command.length > 0 ? command : fallback;
  return [resolved];
}

function serializeShellCommand(args) {
  return args
    .map((token) => {
      if (token === undefined || token === null) {
        return '';
      }
      const value = String(token);
      if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
        return value;
      }
      const escaped = value.replace(/'/g, "'\\''");
      return `'${escaped}'`;
    })
    .filter(Boolean)
    .join(' ');
}

async function runShellWithPrivilege(args, serial) {
  const errors = [];
  const serialized = serializeShellCommand(args);
  try {
    if (1) {
      console.debug(`Running shell command: ${serializeShellCommand(args)}`);
    }
    return await adbService.shell(args, { serial });
  } catch (error) {
    errors.push({ error, source: `direct (${serializeShellCommand(args)})` });
  }

  const suVariants = [
    { source: 'su 0 direct', args: ['su', '0', ...args] },
    { source: 'su direct', args: ['su', ...args] },
    { source: 'su 0 sh -c', args: ['su', '0', 'sh', '-c', serialized] },
    { source: 'su sh -c', args: ['su', 'sh', '-c', serialized] },
  ];

  for (const variant of suVariants) {
    try {
      return await adbService.shell(variant.args, { serial });
    } catch (error) {
      errors.push({ error, source: variant.source });
    }
  }

  const permissionError = errors.find(({ error }) => PERMISSION_DENIED_PATTERN.test(error.message));
  if (permissionError) {
    const adminError = new Error(
      'Infrared command requires elevated (root) privileges on the Android TV. Grant adb shell root access and try again.',
    );
    adminError.cause = permissionError.error;
    throw adminError;
  }

  const lastError = errors.at(-1)?.error ?? new Error('Unknown ADB shell failure');
  const detail = errors
    .map(({ error, source }) => `${source}: ${error.message || 'no details'}`)
    .join(' | ');
  const enrichedError = new Error(detail || lastError.message);
  enrichedError.cause = lastError;
  throw enrichedError;
}

function normalizeStateValue(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.replace(/\0/g, '').trim();
  if (trimmed === '') {
    return null;
  }
  if (trimmed === '0' || trimmed === '1') {
    return trimmed;
  }

  const digitMatch = trimmed.match(/[01]/);
  return digitMatch ? digitMatch[0] : trimmed;
}

function buildWriteCommand(value) {
  const fallback = value === '1' ? DEFAULT_ENABLE_COMMAND : DEFAULT_DISABLE_COMMAND;
  return buildShellCommand(value === '1' ? CUSTOM_ENABLE_COMMAND : CUSTOM_DISABLE_COMMAND, fallback);
}

async function readInfraredState(serial) {
  const commandArgs = buildShellCommand(CUSTOM_READ_COMMAND, DEFAULT_READ_COMMAND);
  let stdout;
  try {
    ({ stdout } = await runShellWithPrivilege(commandArgs, serial));
  } catch (error) {
    await assertInfraredPathExists(serial);
    throw error;
  }

  if (stdout == null) {
    throw new Error('Infrared state response was null.');
  }
  else {
    console.debug(`Infrared state response was: ${stdout}`);
  }


  const normalized = normalizeStateValue(stdout);
  if (normalized === '0' || normalized === '1') {
    return normalized === '1';
  }
  if (normalized == null) {
    await assertInfraredPathExists(serial);
    throw new Error('Infrared state response was empty.');
  }

  throw new Error(`Unexpected infrared state value: '${normalized}'`);
}

async function writeInfraredState(enabled, serial) {
  const value = enabled ? '1' : '0';
  const commandArgs = buildWriteCommand(value);

  try {
    await runShellWithPrivilege(commandArgs, serial);
  } catch (error) {
    await assertInfraredPathExists(serial);
    throw error;
  }

  let lastObserved = null;
  for (let attempt = 0; attempt < WRITE_VERIFICATION_RETRIES; attempt += 1) {
    const current = await readInfraredState(serial);
    lastObserved = current ? '1' : '0';
    if (current === enabled) {
      console.debug(`Infrared state verified as '${lastObserved}'`);
      return current;
    }
    await delay(WRITE_VERIFICATION_DELAY);
  }

  throw new Error(
    `Infrared state remained '${lastObserved ?? 'unknown'}' after attempting to set '${value}'. ` +
      'Run the disable/enable command manually (or set INFRARED_DISABLE_COMMAND/INFRARED_ENABLE_COMMAND) to ensure your device allows this toggle.',
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertInfraredPathExists(serial) {
  const { stdout } = await runShellWithPrivilege(
    ['sh', '-c', `[ -e ${INFRARED_ENABLE_PATH} ] && echo __exists__ || echo __missing__`],
    serial,
  );
  if (!stdout.includes('__exists__')) {
    throw new Error(`Infrared sysfs path '${INFRARED_ENABLE_PATH}' is missing on this device.`);
  }
}

module.exports = {
  INFRARED_ENABLE_PATH,
  readInfraredState,
  writeInfraredState,
};
