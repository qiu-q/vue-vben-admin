# PLC 设备 JSON 标准化生成流程（示例）

本示例文档用于规范“根据接口用 curl 获取返回 → 生成可导入的设备 JSON”的流程与信息收集模板。你只要按模板提供信息，我就能一步一步产出可导入 `/control/device-editor` 的 JSON。

## 你需要准备/确认的内容（Checklist）
- 设备信息
  - deviceId（渲染使用的 ID，如 25/33 等）
  - 画布尺寸：width、height（默认 1920×1080）
- 接口访问方式（二选一）
  - 直连后端：`http://192.168.0.101:8080`
  - 代理前端：`http://localhost:5777/api`
- 模块清单（每个模块 = 一个接口）
  - moduleIndex（如 1、7、11、14…）
  - 接口 URL 模板或明确 URL
  - 该模块 rows 数量（用于校验/排位）
  - 底图配置：src/x/y/width/height（若各模块相同，仅需给一份公共底图 + 横向平移步长 stepX）
  - 灯位坐标：
    - 方式 A：给出基准模块的每个 rows[i] 的绝对坐标（x/y）
    - 方式 B：给出相对底图左上角的偏移坐标（dx/dy）
- 图标与映射
  - on(true) 图标（如绿灯）：`http://192.168.0.101:9000/qiuqiu/green.gif`
  - off(false) 图标（空白）：`http://192.168.0.101:9000/qiuqiu/null.png`
  - hover 显示：`rows[i].registerDescribe`

## 你给我的信息模板（复制粘贴后填写）
```md
# BUILD REQUEST

- deviceId: 33
- canvas:
  width: 1920
  height: 1080
- access: direct | proxy
- baseHost:
  direct: http://192.168.0.101:8080
  proxy:  http://localhost:5777/api
- urlPattern: 
  # 若使用模板，填：/jx-device/registerTable/list?deviceId={deviceId}&registerModuleIndex={moduleIndex}&pageSize=0
  value: /jx-device/registerTable/list?deviceId={deviceId}&registerModuleIndex={moduleIndex}&pageSize=0

- icons:
  true:  http://192.168.0.101:9000/qiuqiu/green.gif
  false: http://192.168.0.101:9000/qiuqiu/null.png

- background:
  # 所有模块公用底图（若每个模块不同，可在 modules[].background 覆盖）
  src:  http://192.168.0.101:9000/qiuqiu/微信图片_20251114114113_982_8.png
  x:    682.7040372799738
  y:    7.8986575643110655
  width: 197
  height: 768
  stepX: 479   # 第二组向右平移距离

- positions:
  # 方式 A：给出 rows[i] 的绝对坐标（针对基准模块）
  # pairs: [ { x: 728, y: 158 }, { x: 727, y: 195 }, ... ]
  # 方式 B：给出相对底图的偏移（推荐），更易于横向平移
  offsets:
    - { dx: 45.2959627200262,  dy: 150.10134243568893 }  # = (728-背景x, 158-背景y)
    - { dx: 44.2959627200262,  dy: 187.10134243568893 }
    - { dx: 45.2959627200262,  dy: 225.10134243568893 }
    # ... 按 rows 顺序提供完

- modules:
  # 为每个模块声明 moduleIndex 与可选 rowsCount；如有个别底图不同，在此覆盖 background
  - moduleIndex: 1
    rowsCount: 16
  - moduleIndex: 7
    rowsCount: 16
  - moduleIndex: 11
    rowsCount: 16
  - moduleIndex: 14
    rowsCount: 16
```

> 备注：如果暂时没有精确灯位坐标，可只给模块清单，我会先按“单列等距”自动排版，一个 JSON 出来后你再微调坐标。

## 我将如何执行（标准步骤）
1) 校验环境
- 可达性：对每个模块接口执行 curl → 确认返回 200 且 rows 为数组
- 校验 rows 数量与 positions 数量是否一致（或记录差异并告知）

2) 采样确认（可选）
- 抽样 1~2 个模块，打印 rows[0..3] 的关键字段（registerId/registerDescribe/registerAddressState）供你确认

3) 生成 JSON（front/back/detail 结构）
- front.layers：
  - 按 modules 顺序生成每组：先放底图，再按 positions/offsets 逐一放置端口
  - 每组 groupId = `mod-{moduleIndex}`，端口 id = `mod-{m}-port-{i}`
  - 端口 config：
    - apiId = `api-module-{moduleIndex}`
    - portDataKey = `rows[{i}].registerAddressState`；hover.dataKey = `rows[{i}].registerDescribe`
    - statusMapping.true/false = 你提供的图标（true=绿，false=空）
- front.apiList：
  - 按 modules 生成完整接口清单（直连或代理 URL）
- back/detail：
  - 默认空视图（如有需要可复制 front）

4) 输出与校验
- 写入：`apps/web-ele/设备示例/device_{deviceId}.json`
- 校验：
  - JSON 语法检查
  - 端口/接口数量是否与 modules/rows 对齐

5) 导入与验证
- 在 `/control/device-editor` → 导入 JSON
- 用 `/control/device-view/{deviceId}` 预览端口状态

## 标准命令（参考）
- curl 采样（直连）：
```bash
curl -s 'http://192.168.0.101:8080/jx-device/registerTable/list?deviceId=33&registerModuleIndex=1&pageSize=0' | jq '.rows[0:3]'
```
- curl 采样（代理）：
```bash
curl -s 'http://localhost:5777/api/jx-device/registerTable/list?deviceId=33&registerModuleIndex=1&pageSize=0' | jq '.rows[0:3]'
```
- 生成脚本（已内置，若需我执行会自动修改参数/偏移后运行）：
  - `scripts/generate-device-editor-json.mjs` → 基础端口/接口 JSON（不含底图排版）
  - `scripts/build-device-33.mjs` → 按底图模板横向批量排版（我会用你的 offsets/stepX 生成）

## 输出规范（导入即用）
- 文件必须包含 3 视图：`front/back/detail`
- front 层：
  - `deviceId`、`width/height`
  - `layers`（含 image + port-adv，带 groupId）
  - `apiList`（id = api-module-{index}）
- 预览端渲染逻辑：
  - `port-adv` 未取到状态时使用 false.iconUrl（空图）兜底
  - 背景 `image` 不拦截鼠标（pointer-events 禁用）

## 常见变体
- 若每个模块底图不同：在 modules[].background 覆盖统一底图
- 若端口为二维分布：提供二维 offsets（例如 offsetsA/b）或明确 rows[i] 的 (x,y)
- 若 rows 数量与 offsets 数量不等：
  - 我会提示，并按较小数量生成，其余保留待补

—— 按以上模板把信息发给我，我会：
- 先 curl 校验接口 → 确认 rows
- 再按你的底图/偏移/步长生成 front/back/detail JSON
- 将结果写入 `apps/web-ele/设备示例/device_{deviceId}.json` 并告知导入验证步骤

