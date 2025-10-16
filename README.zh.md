# TVControl

TVControl 是一个基于 Web 的 Android TV 遥控器，前端使用 React，后端使用 Express。它通过 Android Debug Bridge（ADB）发送指令，让你能够在浏览器中完成换台、调节音量、导航等实体遥控器通常提供的操作。

## 功能特性

- 通过 TCP/IP（IP:端口）快速连接设备的辅助工具
- 实时查看设备列表与连接状态
- 提供数字键盘与直接输入频道号的快捷换台功能
- 支持播放、音量、静音、电源等多种媒体控制指令
- 包含方向键（D-Pad）与确认键的导航区域
- 提供 REST API，便于与外部工具或自动化流程集成

## 前置条件

- Node.js 18 或更高版本
- 系统 `PATH` 中可访问的 Android Debug Bridge (`adb`)；若无法直接访问，可通过环境变量 `ADB_PATH` 指定
- Android TV 已启用网络调试（`设置 > 设备偏好设置 > 关于 > Build` 连续点击开启开发者选项，然后开启 `ADB 调试` 与 `网络调试`）

## 快速开始

```bash
npm install
npm install --prefix client
npm run dev
```

该命令会同时启动 Express API（默认端口 `5000`）与 Vite 开发服务器（默认端口 `5173`）。客户端会将 `/api/*` 请求代理到后端，因此打开 http://localhost:5173 即可直接控制电视。

## 使用指南

### 网络连接 (TCP/IP)

1. 查询电视设备的 IP 地址，例如 `192.168.1.30`。
2. 如果设备尚未开放 TCP/IP ADB 连接，可在终端执行 `adb connect <ip>:5555`，或者在网页端的 **Connect** 表单中输入 `IP:端口`（默认端口为 `5555`）。
3. 在电视端接受调试授权弹窗。
4. 返回网页后，观察 **Device Connection** 列表，当设备状态显示为 `device` 时，点击该项即可将其设为当前控制目标。

### USB 与手动序列号模式

当电视无法通过网络访问时，可保持 USB 连接：

1. 使用 USB 数据线连接电视，并执行 `adb devices`，确认设备状态为 `device`。
2. 保持数据线连接（若稍后计划切换到 Wi-Fi，可执行 `adb tcpip 5555`）。打开 TVControl 页面后，应用会尝试自动列出该设备。
3. 如果列表中能看到设备，直接点击即可；若列表未显示，勾选 **Use manual serial**，并在输入框填入 `adb devices` 输出的序列号。只要手动序列号非空，遥控面板内的所有按键都会保持可用。

### 遥控面板操作

- 查看页面顶部的状态标签，确认显示为 “Manual control active” 或者显示至少一个在线设备。
- 使用方向键区进行导航，中央按键等同于确认 (`OK/Enter`)。
- 音量、频道、媒体与系统功能按键按组排列，点击即刻发送对应的 ADB 指令。
- 可在频道输入框中填写频道号并点击 **Change**，或直接点击数字键盘；系统会依次发送每个数字并自动补发 `Enter`。
- 成功或错误提示会显示在连接区域下方，便于追踪每一次指令的执行结果。

## 可用 API 接口

- `POST /api/connect` – 请求体 `{ "host": "192.168.1.30:5555" }`，用于建立 TCP/IP ADB 连接。
- `POST /api/disconnect` – 可选地传入 `{ "host": "..." }` 指定断开目标，否则断开全部。
- `GET /api/status` – 返回 `adb devices` 的设备列表。
- `POST /api/command` – 请求体 `{ "action": "volume_up", "serial": "可选的设备序列号" }`，发送映射的按键事件。完整列表见 `server/commandMap.js`。
- `POST /api/channel` – 请求体 `{ "number": "101", "serial": "可选的设备序列号" }`，依序发送数字按键并在末尾追加 `Enter`。
- `POST /api/text` – 请求体 `{ "text": "search query", "serial": "可选的设备序列号" }`，通过 `adb shell input text` 注入文本。

## 生产环境构建

使用以下命令打包客户端：

```bash
npm run build
```

构建后的文件位于 `client/dist`。设置 `NODE_ENV=production` 并运行 `npm run server:start`，即可通过 Express 同时提供 API 与静态资源。

## 环境变量

- `PORT` – 自定义 Express 服务器端口（默认 `5000`）。
- `ADB_PATH` – 当 `adb` 不在 `PATH` 时，用于指定其绝对路径。
- `ADB_COMMAND_TIMEOUT` – ADB 指令的超时时间（毫秒，默认 `5000`）。

## VS Code 任务

在 `.vscode/tasks.json` 中预置了 `npm: dev` 任务，可一键启动前后端开发环境。

## 常见问题排查

- 如果列表中没有设备，请在终端再次执行 `adb devices`，确认电视是否在线。
- 遥控按键无响应时，请检查电视端是否已接受调试授权，并保持在线状态。
- 在 Windows 上，首次连接时可能需要以管理员身份运行 PowerShell 或 VS Code 终端。
