import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const COMMAND_LABELS = {
  power_toggle: 'Power',
  power_on: 'Power On',
  power_off: 'Power Off',
  home: 'Home',
  back: 'Back',
  menu: 'Menu',
  info: 'Info',
  tv_guide: 'Guide',
  settings: 'Settings',
  source: 'Input',
  volume_up: 'Vol +',
  volume_down: 'Vol -',
  mute: 'Mute',
  channel_up: 'Ch +',
  channel_down: 'Ch -',
  play_pause: 'Play/Pause',
  stop: 'Stop',
  rewind: 'Rewind',
  fast_forward: 'Fast Fwd',
  dpad_up: 'Up',
  dpad_down: 'Down',
  dpad_left: 'Left',
  dpad_right: 'Right',
  dpad_center: 'OK',
  color_red: 'Red',
  color_green: 'Green',
  color_yellow: 'Yellow',
  color_blue: 'Blue',
  enter: 'Enter',
  digit_0: '0',
  digit_1: '1',
  digit_2: '2',
  digit_3: '3',
  digit_4: '4',
  digit_5: '5',
  digit_6: '6',
  digit_7: '7',
  digit_8: '8',
  digit_9: '9',
}

const ACTION_GROUPS = [
  {
    title: 'System',
    buttons: [
      { action: 'power_toggle', variant: 'danger' },
      { action: 'home' },
      { action: 'back' },
      { action: 'menu' },
      { action: 'info' },
      { action: 'tv_guide' },
      { action: 'settings' },
      { action: 'source' },
    ],
  },
  {
    title: 'Volume',
    buttons: [
      { action: 'volume_up', variant: 'accent' },
      { action: 'volume_down', variant: 'accent' },
      { action: 'mute' },
    ],
  },
  {
    title: 'Channels',
    buttons: [
      { action: 'channel_up' },
      { action: 'channel_down' },
    ],
  },
  {
    title: 'Playback',
    buttons: [
      { action: 'play_pause' },
      { action: 'stop' },
      { action: 'rewind' },
      { action: 'fast_forward' },
    ],
  },
]

const DPAD_ACTIONS = {
  up: 'dpad_up',
  down: 'dpad_down',
  left: 'dpad_left',
  right: 'dpad_right',
  center: 'dpad_center',
}

const COLOR_KEY_BUTTONS = [
  { action: 'color_red', variant: 'red' },
  { action: 'color_green', variant: 'green' },
  { action: 'color_yellow', variant: 'yellow' },
  { action: 'color_blue', variant: 'blue' },
]

const PREFERENCE_STORAGE_KEY = 'tvcontrol:preferences'

function App() {
  const [deviceHost, setDeviceHost] = useState('')
  const [devices, setDevices] = useState([])
  const [statusMessage, setStatusMessage] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [channelInput, setChannelInput] = useState('')
  const [statusErrorCount, setStatusErrorCount] = useState(0)
  const [selectedSerial, setSelectedSerial] = useState('')
  const [useManualSerial, setUseManualSerial] = useState(false)
  const [manualSerial, setManualSerial] = useState('')
  const isMountedRef = useRef(true)
  const preferencesLoadedRef = useRef(false)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      preferencesLoadedRef.current = true
      return
    }

    try {
      const stored = localStorage.getItem(PREFERENCE_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        const manualSerialValue = typeof parsed.manualSerial === 'string' ? parsed.manualSerial : ''
        const storedSelectedSerial = typeof parsed.selectedSerial === 'string' ? parsed.selectedSerial : ''
        const storedUseManualSerial = typeof parsed.useManualSerial === 'boolean' ? parsed.useManualSerial : false
        const storedDeviceHost = typeof parsed.deviceHost === 'string' ? parsed.deviceHost : ''

        setManualSerial(manualSerialValue)
        setSelectedSerial(storedSelectedSerial)
        setUseManualSerial(storedUseManualSerial && manualSerialValue.trim().length > 0)
        setDeviceHost(storedDeviceHost)
      }
    } catch (error) {
      console.warn('Failed to restore saved preferences', error)
    } finally {
      preferencesLoadedRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!preferencesLoadedRef.current || typeof window === 'undefined') {
      return
    }

    try {
      const payload = {
        manualSerial,
        selectedSerial,
        useManualSerial,
        deviceHost,
      }
      localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.warn('Failed to persist preferences', error)
    }
  }, [deviceHost, manualSerial, selectedSerial, useManualSerial])

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/status')
      if (!response.ok) {
        throw new Error('Unable to read device status')
      }
      const payload = await response.json()
      if (isMountedRef.current) {
        const nextDevices = payload.devices ?? []
        setDevices(nextDevices)
        if (statusErrorCount > 0) {
          setStatusMessage((current) => (current?.type === 'error' ? null : current))
        }
        setStatusErrorCount(0)

        if (!useManualSerial) {
          const connected = nextDevices.filter((device) => device.state === 'device')
          const hasSelected = connected.some((device) => device.serial === selectedSerial)
          if (!hasSelected) {
            if (connected.length === 1) {
              setSelectedSerial(connected[0].serial)
            } else if (connected.length === 0) {
              setSelectedSerial('')
            }
          }
        }
      }
    } catch (error) {
      console.error('Status refresh failed', error)
      if (isMountedRef.current) {
        setStatusErrorCount((count) => Math.min(count + 1, 3))
        if (statusErrorCount === 0) {
          setStatusMessage({
            type: 'error',
            text: 'Unable to reach backend. Ensure the Node server is running on port 5000.',
          })
        }
      }
    }
  }, [selectedSerial, statusErrorCount, useManualSerial])

  useEffect(() => {
    refreshStatus()
    const intervalId = setInterval(refreshStatus, 5000)
    return () => clearInterval(intervalId)
  }, [refreshStatus])

  const connectedDevices = useMemo(
    () => devices.filter((device) => device.state === 'device'),
    [devices],
  )

  const manualSerialValue = useMemo(
    () => (useManualSerial ? manualSerial.trim() : ''),
    [manualSerial, useManualSerial],
  )
  const manualActive = useManualSerial && manualSerialValue.length > 0
  const isConnected = (!useManualSerial && connectedDevices.length > 0) || manualActive

  const updateStatusMessage = useCallback((message) => {
    if (isMountedRef.current) {
      setStatusMessage(message)
    }
  }, [])

  const connectToDevice = useCallback(async () => {
    const host = deviceHost.trim()
    if (!host) {
      updateStatusMessage({ type: 'error', text: 'Enter the Android TV host in the format IP:port.' })
      return
    }

    setIsConnecting(true)
    updateStatusMessage(null)
    try {
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? payload.detail ?? 'Connect failed')
      }
      updateStatusMessage({ type: 'success', text: payload.message ?? `Connected to ${host}` })
      await refreshStatus()
    } catch (error) {
      console.error('Connect failed', error)
      updateStatusMessage({ type: 'error', text: error.message })
    } finally {
      if (isMountedRef.current) {
        setIsConnecting(false)
      }
    }
  }, [deviceHost, refreshStatus, updateStatusMessage])

  const disconnectDevice = useCallback(async () => {
    if (!deviceHost.trim() && connectedDevices.length === 0) {
      updateStatusMessage({ type: 'error', text: 'No connected devices to disconnect.' })
      return
    }

    updateStatusMessage(null)
    try {
      const response = await fetch('/api/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: deviceHost.trim() || undefined }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? payload.detail ?? 'Disconnect failed')
      }
      updateStatusMessage({ type: 'success', text: payload.message || 'Disconnected from device' })
      await refreshStatus()
    } catch (error) {
      console.error('Disconnect failed', error)
      updateStatusMessage({ type: 'error', text: error.message })
    }
  }, [connectedDevices.length, deviceHost, refreshStatus, updateStatusMessage])

  const resolveActiveSerial = useCallback(() => {
    if (useManualSerial) {
      if (!manualSerialValue) {
        return { serial: null, error: 'Enter a device serial or disable manual serial mode.' }
      }
      return { serial: manualSerialValue }
    }

    const autoSerial = selectedSerial || (connectedDevices.length === 1 ? connectedDevices[0].serial : '')
    if (!autoSerial && connectedDevices.length > 1) {
      return { serial: null, error: 'Select a target device before sending commands.' }
    }

    return { serial: autoSerial }
  }, [connectedDevices, manualSerialValue, selectedSerial, useManualSerial])

  const sendCommand = useCallback(
    async (action) => {
      if (!isConnected) {
        updateStatusMessage({ type: 'error', text: 'Connect to an Android TV device before sending commands.' })
        return
      }

      const { serial: targetSerial, error } = resolveActiveSerial()
      if (error) {
        updateStatusMessage({ type: 'error', text: error })
        return
      }

      updateStatusMessage(null)
      try {
        const response = await fetch('/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, serial: targetSerial || undefined }),
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error ?? payload.detail ?? 'Command failed')
        }
        updateStatusMessage({ type: 'success', text: `${COMMAND_LABELS[action] ?? action} command sent` })
      } catch (error) {
        console.error('Command failed', error)
        updateStatusMessage({ type: 'error', text: error.message })
      }
    },
    [isConnected, resolveActiveSerial, updateStatusMessage],
  )

  const submitChannelChange = useCallback(
    async (event) => {
      event.preventDefault()
      const channel = channelInput.trim()
      if (!channel) {
        updateStatusMessage({ type: 'error', text: 'Enter a channel number before sending.' })
        return
      }
      if (!/^\d+$/.test(channel)) {
        updateStatusMessage({ type: 'error', text: 'Channel number must contain digits only.' })
        return
      }
      if (!isConnected) {
        updateStatusMessage({ type: 'error', text: 'Connect to an Android TV device before sending commands.' })
        return
      }

      const { serial: targetSerial, error } = resolveActiveSerial()
      if (error) {
        updateStatusMessage({ type: 'error', text: error })
        return
      }

      updateStatusMessage(null)
      try {
        const response = await fetch('/api/channel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: channel, serial: targetSerial || undefined }),
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error ?? payload.detail ?? 'Failed to change channel')
        }
        updateStatusMessage({ type: 'success', text: `Channel changed to ${payload.channel}` })
        if (isMountedRef.current) {
          setChannelInput('')
        }
      } catch (error) {
        console.error('Channel change failed', error)
        updateStatusMessage({ type: 'error', text: error.message })
      }
    },
    [channelInput, isConnected, resolveActiveSerial, updateStatusMessage],
  )

  const sendDpad = useCallback(
    (direction) => {
      const action = DPAD_ACTIONS[direction]
      if (action) {
        void sendCommand(action)
      }
    },
    [sendCommand],
  )

  const handleDigitPress = useCallback(
    (digit) => {
      if (!isConnected) {
        return
      }
      setChannelInput((current) => `${current}${digit}`.slice(0, 6))
      void sendCommand(`digit_${digit}`)
    },
    [isConnected, sendCommand],
  )

  const statusSummary = useMemo(() => {
    if (useManualSerial) {
      if (manualSerialValue) {
        return `Manual control active via ${manualSerialValue}`
      }
      return 'Manual serial enabled · waiting for a serial value'
    }

    if (isConnected) {
      const suffix = connectedDevices.length > 1 ? 's' : ''
      const detail = selectedSerial ? ` · selected ${selectedSerial}` : ''
      return `Connected to ${connectedDevices.length} device${suffix}${detail}`
    }

    return 'No Android TV devices detected'
  }, [connectedDevices.length, isConnected, manualSerialValue, selectedSerial, useManualSerial])

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1>TVControl Remote</h1>
          <p>Control your Android TV via ADB, including channel and volume adjustments.</p>
        </div>
        <div className={`status-indicator ${isConnected ? 'status-indicator--online' : 'status-indicator--offline'}`}>
          <span className="status-dot" />
          <span>{statusSummary}</span>
        </div>
      </header>

      <section className="card">
        <h2>Device Connection</h2>
        <div className="connection-row">
          <input
            className="text-input"
            type="text"
            placeholder="e.g. 192.168.1.30:5555"
            value={deviceHost}
            onChange={(event) => setDeviceHost(event.target.value)}
            disabled={isConnecting}
          />
          <button className="primary-button" type="button" onClick={connectToDevice} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
          <button className="secondary-button" type="button" onClick={disconnectDevice}>
            Disconnect
          </button>
        </div>

        <p className="device-list__hint">
          Click a connected device to make it active, or enable manual serial mode for USB-only setups.
        </p>
        <div className="device-list">
          {devices.length === 0 ? (
            <p className="device-list__empty">No devices reported yet. Connect using the form above.</p>
          ) : (
            devices.map((device) => {
              const isOnline = device.state === 'device'
              const isSelected = !useManualSerial && selectedSerial === device.serial
              return (
                <button
                  type="button"
                  key={device.serial}
                  className={`device-list__item ${isSelected ? 'device-list__item--selected' : ''}`}
                  onClick={() => {
                    if (isOnline) {
                      setUseManualSerial(false)
                      setSelectedSerial((prev) => (prev === device.serial ? '' : device.serial))
                    }
                  }}
                  disabled={!isOnline}
                >
                  <div>
                    <strong>{device.serial}</strong>
                    <span className={`badge ${isOnline ? 'badge--success' : 'badge--muted'}`}>{device.state}</span>
                  </div>
                  <div className="device-list__item-meta">
                    {device.isEmulator ? <span className="badge badge--info">Emulator</span> : null}
                    {isSelected ? <span className="badge badge--accent">Selected</span> : null}
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="manual-serial">
          <label className="manual-serial__toggle">
            <input
              type="checkbox"
              checked={useManualSerial}
              onChange={(event) => {
                const checked = event.target.checked
                setUseManualSerial(checked)
                if (checked) {
                  setSelectedSerial('')
                }
              }}
            />
            Use manual serial
          </label>
          <input
            className="text-input manual-serial__input"
            type="text"
            placeholder="Enter device serial (e.g. R3DN123456 or 192.168.1.30:5555)"
            value={manualSerial}
            onChange={(event) => setManualSerial(event.target.value)}
            disabled={!useManualSerial}
          />
          <p className="manual-serial__hint">
            When enabled, commands are sent to this serial even if it is not listed above.
          </p>
        </div>
      </section>

      {statusMessage ? (
        <div className={`alert ${statusMessage.type === 'error' ? 'alert--error' : 'alert--success'}`}>
          {statusMessage.text}
        </div>
      ) : null}

      <section className="card">
        <h2>Remote Control</h2>
        <div className="remote-layout">
          <div className="remote-group">
            <h3>Directional Pad</h3>
            <div className="dpad">
              <button type="button" className="remote-button" onClick={() => sendDpad('up')} disabled={!manualActive && !connectedDevices.length}>
                {COMMAND_LABELS[DPAD_ACTIONS.up]}
              </button>
              <button type="button" className="remote-button" onClick={() => sendDpad('left')} disabled={!manualActive && !connectedDevices.length}>
                {COMMAND_LABELS[DPAD_ACTIONS.left]}
              </button>
              <button type="button" className="remote-button" onClick={() => sendDpad('center')} disabled={!manualActive && !connectedDevices.length}>
                {COMMAND_LABELS[DPAD_ACTIONS.center]}
              </button>
              <button type="button" className="remote-button" onClick={() => sendDpad('right')} disabled={!manualActive && !connectedDevices.length}>
                {COMMAND_LABELS[DPAD_ACTIONS.right]}
              </button>
              <button type="button" className="remote-button" onClick={() => sendDpad('down')} disabled={!manualActive && !connectedDevices.length}>
                {COMMAND_LABELS[DPAD_ACTIONS.down]}
              </button>
            </div>
            <div className="color-keys">
              {COLOR_KEY_BUTTONS.map(({ action, variant }) => (
                <button
                  type="button"
                  key={action}
                  className={`remote-button ${variant ? `remote-button--${variant}` : ''}`}
                  onClick={() => void sendCommand(action)}
                  disabled={!manualActive && !connectedDevices.length}
                >
                  {COMMAND_LABELS[action] ?? action}
                </button>
              ))}
            </div>
          </div>

          <div className="remote-group">
            <h3>Channel</h3>
            <form className="channel-form" onSubmit={submitChannelChange}>
              <input
                className="text-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={channelInput}
                onChange={(event) => setChannelInput(event.target.value)}
                placeholder="Enter channel number"
                disabled={!manualActive && !connectedDevices.length}
              />
              <button className="primary-button" type="submit" disabled={!manualActive && !connectedDevices.length}>
                Change
              </button>
            </form>
            <div className="number-pad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((number) => (
                <button
                  type="button"
                  key={number}
                  className="remote-button"
                  onClick={() => handleDigitPress(number)}
                  disabled={!manualActive && !connectedDevices.length}
                >
                  {number}
                </button>
              ))}
            </div>
          </div>

          <div className="remote-group remote-group--grid">
            {ACTION_GROUPS.map((group) => (
              <div key={group.title} className="remote-subgroup">
                <h3>{group.title}</h3>
                <div className="remote-buttons">
                  {group.buttons.map(({ action, variant }) => (
                    <button
                      type="button"
                      key={action}
                      className={`remote-button ${variant ? `remote-button--${variant}` : ''}`}
                      onClick={() => void sendCommand(action)}
                      disabled={!manualActive && !connectedDevices.length}
                    >
                      {COMMAND_LABELS[action] ?? action}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
