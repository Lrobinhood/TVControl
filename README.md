# TVControl

TVControl is a web-based remote controller for Android TV devices built with a React frontend and an Express backend. It issues commands over Android Debug Bridge (ADB) so you can change channels, adjust volume, and navigate the system from any browser on your network.

## Features

- Device connection helper for ADB over TCP/IP (IP:port)
- Live device status and connection state
- Channel shortcuts with numeric keypad and direct channel input
- Media controls for playback, volume, mute, and power states
- Media controls for playback, volume, mute, color keys, and power states
- Directional pad for navigation (D-pad and center select)
- REST API endpoints for integration with other tools or automations
- Remembers your last manual serial and target selection between sessions

## Prerequisites

- Node.js 18 or later
- Android Debug Bridge (`adb`) available in your system `PATH` (or provide `ADB_PATH` env var)
- Android TV with ADB over network enabled (`Settings > Device Preferences > About > Build` tap to enable developer options, then enable `ADB debugging` and `Network debugging`)

## Getting Started

```bash
npm install
npm install --prefix client
npm run dev
```

The combined development server starts the Express API on port `5000` and the Vite dev server on port `5173`. The client proxies `/api/*` requests to the backend, so you can open http://localhost:5173 and control your TV immediately.

## User Guide

### Connect over Network (TCP/IP)

1. Determine the device IP address (e.g., `192.168.1.30`).
2. If the device does not already accept TCP/IP ADB connections, run `adb connect <ip>:5555` from a terminal or use the **Connect** form in the web UI. The default Android TV port is `5555`.
3. Accept the trust prompt that appears on the TV screen.
4. Watch the **Device Connection** list in the UI. Once the device reports the `device` state you can click it to make it active.

### USB and Manual Serial Mode

If the Android TV cannot be reached over the network, keep it attached to the computer running TVControl via USB:

1. Connect the TV with a USB cable and run `adb devices` to confirm it appears with the `device` state.
2. Leave the cable attached (or execute `adb tcpip 5555` if you plan to migrate to Wi-Fi later). TVControl will attempt to list the USB device automatically when you open the app.
3. In the UI, either click the detected USB device or toggle **Use manual serial** and paste the serial from `adb devices`. As long as the manual serial field contains a value, every command in the remote remains enabled.
4. Your manual serial entry and toggle preference are saved locally so the remote is ready the next time you open the page.

### Operate the Remote

- Review the status pill in the header to make sure it reads `Manual control active` or reports at least one online device.
- Use the D-pad cluster for navigation, and the center button for `OK`/`Enter` actions.
- Volume, channel, media, and system controls are organised into dedicated groups. Clicking a button sends the associated ADB key event immediately.
- The red, green, yellow, and blue buttons appear below the directional pad for quick access to common shortcuts.
- Enter a channel number in the **Change** form or tap digits on the numeric pad. The UI sends the digit sequence automatically and follows with `Enter`.
- Success or error messages appear beneath the connection card so you can verify each action.

## 使用指南（中文）

### 网络连接 (TCP/IP)

1. 确认电视的 IP 地址，例如 `192.168.1.30`。
2. 如果设备尚未开启 TCP/IP ADB 连接，可在终端执行 `adb connect <ip>:5555`，或直接在网页端的 **Connect** 表单输入 `IP:端口`（默认端口为 `5555`）。
3. 在电视上接受调试授权提示。
4. 返回网页后，观察 **Device Connection** 列表；当设备状态显示为 `device` 时，点击该项可设为当前控制目标。

### USB 与手动序列号模式

当电视无法通过网络访问时，可使用 USB 直连主机：

1. 使用 USB 数据线连接电视，并执行 `adb devices`，确认状态为 `device`。
2. 保持数据线连接（若稍后计划切换到 Wi-Fi，可执行 `adb tcpip 5555`）。打开 TVControl 页面后，应用会尝试自动列出该设备。
3. 如果列表中能看到设备，直接点击即可；若列表未显示，勾选 **Use manual serial**，并在输入框填入 `adb devices` 输出的序列号。只要手动序列号非空，遥控面板中的所有按键都会保持可用。

### 遥控面板操作

- 页面顶部的状态标签会显示当前连接概况，例如“Manual control active”。
- 使用方向键区域进行导航，中央按键等同于确认 (`OK/Enter`)。
- 音量、频道、媒体与系统功能按键以分组展示，点击即刻发送对应的 ADB 指令。
- **Color Keys** 分组提供红、绿、黄、蓝四个彩色按键，对应实体遥控器的快捷键。
- 可在频道输入框填写频道号并点击 **Change**，或直接点击数字小键盘；系统会依次发送每个数字并自动补发 `Enter`。
- 每次操作的成功/错误提示会显示在连接区域下方，便于确认指令是否生效。

### Available API Routes

- `POST /api/connect` – Body `{ "host": "192.168.1.30:5555" }` connects via ADB over TCP/IP.
- `POST /api/disconnect` – Optionally pass `{ "host": "..." }` to disconnect a specific target.
- `GET /api/status` – Returns the connected device list (`adb devices`).
- `POST /api/command` – Body `{ "action": "volume_up", "serial": "optional-device-id" }` sends a mapped key event. See `server/commandMap.js` for all supported actions.
- `POST /api/channel` – Body `{ "number": "101", "serial": "optional-device-id" }` sends digit key presses followed by enter.
- `POST /api/text` – Body `{ "text": "search query", "serial": "optional-device-id" }` injects characters via `adb shell input text`.

### Production Build

Create a bundled client with:

```bash
npm run build
```

The generated files live in `client/dist`. Set `NODE_ENV=production` and run `npm run server:start` to serve both the API and static client from Express.

### Environment Variables

- `PORT` – Override the Express server port (default `5000`).
- `ADB_PATH` – Absolute path to the `adb` executable if it is not on `PATH`.
- `ADB_COMMAND_TIMEOUT` – Milliseconds to wait before aborting an ADB call (default `5000`).

## VS Code Task

A VS Code task is available under `npm: dev` to launch the combined frontend and backend with one command (see `.vscode/tasks.json`).

## Troubleshooting

- If no devices are detected, double-check that `adb devices` lists your TV from a terminal.
- When the remote buttons do nothing, ensure the TV accepted the ADB pairing prompt and remains online.
- On Windows, you may need to run PowerShell or the VS Code terminal as Administrator for the first connection.
