'use strict';

const express = require('express');
const adbService = require('../adbService');
const { COMMAND_KEY_EVENTS, DIGIT_KEYCODES } = require('../commandMap');

const router = express.Router();

router.get('/status', async (_req, res) => {
  try {
    const devices = await adbService.getDevices();
    res.json({ devices });
  } catch (error) {
    handleError(res, error, 'Unable to read device list');
  }
});

router.post('/connect', async (req, res) => {
  try {
    const host = req.body?.host?.trim();
    if (!host) {
      return res.status(400).json({ error: 'Host is required to connect.' });
    }

    const result = await adbService.connect(host);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to connect to device');
  }
});

router.post('/disconnect', async (req, res) => {
  try {
    const host = req.body?.host?.trim();
    const result = await adbService.disconnect(host);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to disconnect device');
  }
});

router.post('/command', async (req, res) => {
  try {
    const action = req.body?.action;
    const serial = req.body?.serial?.trim();
    if (!action) {
      return res.status(400).json({ error: 'Command action is required.' });
    }

    const keySequence = COMMAND_KEY_EVENTS[action];
    if (!keySequence) {
      return res.status(400).json({ error: `Command '${action}' is not supported.` });
    }

    await adbService.sendKeyeventSequence(keySequence, 120, serial);
    res.json({ success: true, action });
  } catch (error) {
    handleError(res, error, 'Failed to send command');
  }
});

router.post('/channel', async (req, res) => {
  try {
    const number = req.body?.number ?? req.body?.channel ?? req.body?.value;
    const confirm = req.body?.confirm ?? true;
    const serial = req.body?.serial?.trim();

    const channelString = String(number ?? '').trim();
    if (!channelString) {
      return res.status(400).json({ error: 'Channel number is required.' });
    }

    if (!/^\d+$/.test(channelString)) {
      return res.status(400).json({ error: 'Channel number must be numeric.' });
    }

    const sequence = channelString.split('').map((digit) => DIGIT_KEYCODES[digit]);
    if (sequence.includes(undefined)) {
      return res.status(400).json({ error: 'Unsupported character in channel number.' });
    }

    if (confirm) {
      sequence.push('KEYCODE_ENTER');
    }

    await adbService.sendKeyeventSequence(sequence, 90, serial);
    res.json({ success: true, channel: channelString });
  } catch (error) {
    handleError(res, error, 'Failed to set channel');
  }
});

router.post('/text', async (req, res) => {
  try {
    const text = req.body?.text;
    const serial = req.body?.serial?.trim();
    if (!text) {
      return res.status(400).json({ error: 'Text payload is required.' });
    }

    await adbService.inputText(text, serial);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Failed to input text');
  }
});

function handleError(res, error, fallbackMessage) {
  // Log to server console for easier debugging without leaking full details to client
  console.error(fallbackMessage, error);
  res.status(500).json({ error: fallbackMessage, detail: error.message });
}

module.exports = router;
