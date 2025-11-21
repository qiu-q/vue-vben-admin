# 端口状态渲染到 JSON 的方法

本文整理“如何把后端接口渲染成 JSON（用于设备编辑器/预览）”。涵盖数据来源、接口、JSON 结构、渲染逻辑与实用脚本。

## 数据与接口
- 数据来源表：`register_table`
  - 关键字段：`device_id`、`register_module_index`、`register_describe`、`register_address_state`（布尔）等。
- 后端接口（单模块全部寄存器）：
  - 直连：`GET http://192.168.0.101:8080/jx-device/registerTable/list?deviceId={id}&registerModuleIndex={idx}&pageSize=0`
  - 代理（开发态）：`GET http://localhost:5777/api/jx-device/registerTable/list?deviceId={id}&registerModuleIndex={idx}&pageSize=0`
- 返回结构要点（示例 rows[*]）：
  - `rows[i].registerAddressState`（布尔）
  - `rows[i].registerDescribe`（名称）

## JSON 基本形态
- 导入编辑器需要 3 视图结构：
  - `front|back|detail` 均为 `{ deviceId, width, height, layers, materialsTree, apiList }`
- 图层类型：
  - 背景图层：`type: "image"`
  - 端口图层：`type: "port-adv"`（高级端口，支持状态映射/事件）
- 模块分组（推荐）：
  - 同一模块的图层加同一 `groupId`，例如 `groupId: "mod-7"`

## 端口图层（port-adv）字段规范
- `config.apiId`：绑定模块接口的 ID（例如 `api-module-7`）。
- `config.portDataKey`：从 API 返回体取值的路径（例如 `rows[3].registerAddressState`）。
- `config.portKey`：当 `portDataKey` 取到的是对象时，再用该 key 取值；常用 `"value"`，否则可留空。
- `config.statusMapping`：状态-图标映射（键名为 true/false）。
  - true 显示“开灯”：`http://192.168.0.101:9000/qiuqiu/green.gif`
  - false 显示“空图”：`http://192.168.0.101:9000/qiuqiu/null.png`
- `config.events.hover`：移入提示，绑定相同 `apiId`，取 `rows[i].registerDescribe`。

示例（单个端口）
```json
{
  "id": "mod-7-port-0",
  "name": "3#配水泵进水电动蝶阀-开阀",
  "type": "port-adv",
  "zIndex": 2,
  "groupId": "mod-7",
  "config": {
    "x": 1208,
    "y": 181,
    "width": 22,
    "height": 22,
    "rotate": 0,
    "src": "http://192.168.0.101:9000/qiuqiu/green.gif",
    "apiId": "api-module-7",
    "portDataKey": "rows[0].registerAddressState",
    "portKey": "value",
    "statusMapping": {
      "true": { "iconUrl": "http://192.168.0.101:9000/qiuqiu/green.gif", "label": "" },
      "false": { "iconUrl": "http://192.168.0.101:9000/qiuqiu/null.png",  "label": "" }
    },
    "events": { "hover": { "apiId": "api-module-7", "dataKey": "rows[0].registerDescribe" } },
    "usePush": false,
    "pushService": ""
  }
}
```

## 接口（apiList）定义规范
- 每个模块一个 `api`，统一命名 `api-module-{index}`：
```json
{
  "id": "api-module-7",
  "name": "模块7",
  "url": "http://192.168.0.101:8080/jx-device/registerTable/list?deviceId=25&registerModuleIndex=7&pageSize=0",
  "method": "GET",
  "interval": 3000,
  "params": "",
  "usePush": false,
  "pushUrl": ""
}
```

## 渲染逻辑（预览端）
- 位置：`apps/web-ele/src/views/control/device-preview/DevicePreviewRender.vue`
- 高级端口取值：
  1) 根据 `config.apiId` 拿到 API 响应缓存；
  2) 用 `getValueByPath(apiResp, config.portDataKey)` 取到值（布尔/对象）；
  3) 若有 `config.portKey`，再取子字段；
  4) 用 `config.statusMapping[val]` 匹配图标与标签。
- 兜底策略：
  - 未取到状态时，`port-adv` 使用 `statusMapping.false.iconUrl`（已改为空图 `null.png`）；
  - 背景图 `image` 层不拦截鼠标（`pointerEvents: none`），避免遮挡端口交互。

## 生成/复用的实用脚本
- 从 SQL/样例生成端口/接口 JSON：
  - `scripts/generate-registers-json.mjs`（按 `deviceId` 抽取寄存器，分组输出）
  - `scripts/generate-device-editor-json.mjs`（生成可导入编辑器的 front JSON，含 hover/状态映射）
- 构建整机演示 JSON（按模块底图横向排布）：
  - `scripts/build-device-33.mjs`
  - 规则：每个模块先放一张底图，再按样例偏移批量放置端口，第二组起向右平移固定步长。

## 导入到编辑器
- 导入文件结构必须包含 `front/back/detail` 三个视图：
  - 示例：`apps/web-ele/设备示例/device_33 (2).json`
- 打开 `/control/device-editor` → “导入JSON” → 选择文件即可。
- 多选/分组：
  - 点击“选择分组”选中整组；
  - 群选模式开启时，点击组内任一图层自动选中整组；
  - 可“复制分组”“导出分组”“编辑分组 JSON”。

## 校验与调试
- 快速验证接口返回：
```bash
curl -s 'http://192.168.0.101:8080/jx-device/registerTable/list?deviceId=25&registerModuleIndex=7&pageSize=0' | jq .
```
- 预览页面：`/control/device-view/{deviceId}`（渲染端口状态）。
- 常见问题：
  - 导入后空白：检查是否包含 `front/back/detail` 结构；
  - 端口不显示：确认 `portDataKey` 是否对齐 `rows[i]`，以及 false 映射是否为空图；
  - 背景遮挡：确认 `image` 层 `pointerEvents` 在预览侧已禁用（已内置）。

## 推荐约定
- `groupId`：按模块分组，形如 `mod-{index}`；
- `apiId`：按模块命名，形如 `api-module-{index}`；
- 端口尺寸：22×22（可按底图适配）；
- 图标：true=绿灯，false=空图（不显示）。

---
如需把“底图 + 端口位置模板”做成可配置自动生成，只需提供底图 URL、偏移数组与平移步长，我可以把它抽成脚本参数，便于按任意模块批量生成。

