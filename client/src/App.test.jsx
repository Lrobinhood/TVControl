import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

const STATUS_RESPONSE = {
  devices: [
    { serial: '192.168.1.30:5555', state: 'device', isEmulator: false },
  ],
}

function mockFetchImplementation() {
  const fetchMock = vi.fn(async (input) => {
    if (typeof input === 'string' && input.endsWith('/api/status')) {
      return {
        ok: true,
        json: async () => STATUS_RESPONSE,
      }
    }

    if (typeof input === 'string' && input.endsWith('/api/command')) {
      return {
        ok: true,
        json: async () => ({ success: true }),
      }
    }

    if (typeof input === 'string' && input.endsWith('/api/channel')) {
      return {
        ok: true,
        json: async () => ({ channel: '101' }),
      }
    }

    return {
      ok: true,
      json: async () => ({}),
    }
  })

  globalThis.fetch = fetchMock
  return fetchMock
}

function resetPreferencesStorage() {
  window.localStorage.removeItem('tvcontrol:preferences')
}

describe('App manual serial behaviour', () => {
  beforeEach(() => {
    resetPreferencesStorage()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('restores manual serial preference and enables remote buttons on load', async () => {
    window.localStorage.setItem(
      'tvcontrol:preferences',
      JSON.stringify({
        manualSerial: 'USB12345',
        selectedSerial: '',
        useManualSerial: true,
        deviceHost: '192.168.1.30:5555',
      }),
    )

    const fetchMock = mockFetchImplementation()

    render(<App />)

    // status polling happens immediately
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/status')
    })

    const manualToggle = screen.getByLabelText(/Use manual serial/i)
    expect(manualToggle).toBeChecked()

    const dpadCenter = screen.getByRole('button', { name: /OK/i })
    expect(dpadCenter).toBeEnabled()

    await userEvent.click(dpadCenter)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/command',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'dpad_center', serial: 'USB12345' }),
        }),
      )
    })
  })

  it('falls back to active device when manual serial disabled and only one device available', async () => {
    mockFetchImplementation()
    render(<App />)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/status')
    })

    const manualToggle = screen.getByLabelText(/Use manual serial/i)
    if (manualToggle.checked) {
      fireEvent.click(manualToggle)
    }

    const volumeUp = screen.getByRole('button', { name: /Vol \+/i })
    expect(volumeUp).toBeEnabled()

    await userEvent.click(volumeUp)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/command',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'volume_up', serial: '192.168.1.30:5555' }),
        }),
      )
    })
  })
})
