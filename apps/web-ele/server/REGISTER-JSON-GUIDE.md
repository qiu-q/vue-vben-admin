# 设备寄存器 JSON 生成与校验指南

目标：为指定设备（示例 deviceId=25：PLC1，IP 172.168.172.11）生成一个可用于渲染“设备所有寄存器状态”的 JSON，其它前端拖拽交互由你完成。

本指南提供：数据来源、接口说明、cURL 验证、自动生成脚本与输出结构说明，方便复用。

## 数据来源
- SQL 样例：`apps/web-ele/设备示例/jx-sql.sql`
  - 设备信息：`device` 表（用于取设备名称和 IP）。
  - 寄存器清单：`register_table` 表（用于取各模块与寄存器定义）。

## 后端接口（寄存器列表）
- 直连（后端）：`GET http://192.168.0.101:8080/jx-device/registerTable/list?deviceId={id}&registerModuleIndex={idx}&pageSize=0`
- 通过本地前端代理（开发态）：`GET http://localhost:5777/api/jx-device/registerTable/list?deviceId={id}&registerModuleIndex={idx}&pageSize=0`
  - 代理规则源于 `vite.config.mts`：`/api` → `http://192.168.0.101:8080`。

示例（deviceId=25，模块 index=7）：
```
curl -s 'http://192.168.0.101:8080/jx-device/registerTable/list?deviceId=25&registerModuleIndex=7&pageSize=0' | jq .

curl -s 'http://localhost:5777/api/jx-device/registerTable/list?deviceId=25&registerModuleIndex=7&pageSize=0' | jq .
```

返回值要点（rows[] 内常见字段）：
- `registerId`、`deviceId`、`registerModelName`、`registerAddress`、`registerAddressState`、`registerDescribe`、`registerNumber`、`registerModuleIndex`。

## 自动生成脚本
- 脚本路径：`scripts/generate-registers-json.mjs`
- 功能：解析 `jx-sql.sql`，抽取指定设备在 `register_table` 的所有寄存器，按 `registerModuleIndex` 分组，生成渲染所需 JSON。

运行示例（生成 deviceId=25 的 JSON）：
```
node scripts/generate-registers-json.mjs --deviceId 25
```
- 默认输入：`apps/web-ele/设备示例/jx-sql.sql`
- 默认输出：`apps/web-ele/设备示例/device_25_registers.json`
- 可选参数：
  - `--sql <path>` 指定 SQL 文件
  - `--out <path>` 指定输出 JSON 文件

## 生成结果位置
- `apps/web-ele/设备示例/device_25_registers.json`

## 输出 JSON 结构说明（概览）
```
{
  "device": { "deviceId": 25, "name": "PLC1", "ip": "172.168.172.11" },
  "modules": [
    {
      "index": 7,
      "name": "LK610 DO",
      "url": "http://192.168.0.101:8080/jx-device/registerTable/list?deviceId=25&registerModuleIndex=7&pageSize=0",
      "registers": [
        {
          "registerId": 691,
          "registerAddress": "%QX2.0",
          "registerAddressState": false,
          "registerDescribe": "3#配水泵进水电动蝶阀-开阀",
          "registerNumber": 1
        },
        ...
      ]
    },
    ...
  ],
  "apis": [
    {
      "index": 7,
      "directUrl": "http://192.168.0.101:8080/jx-device/registerTable/list?deviceId=25&registerModuleIndex=7&pageSize=0",
      "proxyUrl": "/api/jx-device/registerTable/list?deviceId=25&registerModuleIndex=7&pageSize=0",
      "method": "GET",
      "curl": "curl -s 'http://192.168.0.101:8080/jx-device/registerTable/list?deviceId=25&registerModuleIndex=7&pageSize=0' | jq .",
      "curlProxy": "curl -s 'http://localhost:5777/api/jx-device/registerTable/list?deviceId=25&registerModuleIndex=7&pageSize=0' | jq ."
    },
    ...
  ],
  "meta": { "source": "apps/web-ele/设备示例/jx-sql.sql", "generatedAt": "..." }
}
```

说明：
- `modules[].registers[].registerAddressState` 来自 SQL 快照，仅作为初始值；实时渲染应调用 `apis` 中的接口拿最新状态。
- `modules[].url` 与 `apis[].directUrl` 等价，便于直接绑定或测试。

## 开发代理与本地验证
1) 启动前端（含代理）：
```
pnpm -C apps/web-ele run dev
```
或启动 AI 辅助服务（若需要）：
```
pnpm -C apps/web-ele run ai-server
```

2) 通过代理验证某模块数据：
```
curl -s 'http://localhost:5777/api/jx-device/registerTable/list?deviceId=25&registerModuleIndex=7&pageSize=0' | jq .
```

## 在前端的使用建议
- 仅依赖本 JSON 的结构即可完成拖拽与渲染：
  - 模块选择：遍历 `modules[]`。
  - 寄存器项：遍历 `modules[i].registers[]`，展示 `registerDescribe`/`registerAddress` 等。
  - 实时状态：用 `modules[i].url` 或 `apis[]` 中的接口轮询/订阅，取 `rows[*].registerAddressState`。
- 你也可以把 `apps/web-ele/设备示例/device_25_registers.json` 作为“示例 JSON”上传到设备编辑器（AI面板）以参考结构。

## 备注
- 设备元数据来自 `device` 表（示例：deviceId=25 → 名称 PLC1，IP 172.168.172.11）。
- 若切换设备，只需改 `--deviceId` 再运行脚本，即可生成对应 JSON。

