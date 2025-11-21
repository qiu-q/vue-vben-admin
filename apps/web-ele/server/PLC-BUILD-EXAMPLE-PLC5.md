# 示例：基于接口生成 PLC5 的设备 JSON（标准流程）

目标：参考数据库/示例布局，使用 curl 采样接口，生成可直接导入 `/control/device-editor` 的 JSON 文件（front/back/detail 结构），示例命名为 `apps/web-ele/设备示例/device_24.json`（deviceId 可按实际调整）。

## 1) 确认设备与访问方式
- 设备（示例）
  - 设备行：`24  1  PLC2  172.168.172.21`
  - 拟用 deviceId：`24`（若 PLC5 使用其它 ID，请替换）
- 访问方式（二选一）
  - 直连：`http://192.168.0.101:8080`
  - 代理：`http://localhost:5777/api`
- 模块接口模板
  - `/jx-device/registerTable/list?deviceId={deviceId}&registerModuleIndex={moduleIndex}&pageSize=0`

## 2) 探测模块范围（curl 批量）
用下面脚本探测 moduleIndex（1..20 示例），记录有数据（rows.length>0）的模块：

```bash
DEVICE_ID=24
BASE=http://192.168.0.101:8080   # 或 BASE=http://localhost:5777/api
for idx in $(seq 1 20); do
  url="$BASE/jx-device/registerTable/list?deviceId=$DEVICE_ID&registerModuleIndex=$idx&pageSize=0"
  rows=$(curl -s "$url" | jq '.rows | length' 2>/dev/null || echo 0)
  printf "idx=%-2s rows=%s\n" "$idx" "$rows"
  if [ "$rows" -gt 0 ]; then
    mkdir -p /tmp/plc-samples/$DEVICE_ID
    curl -s "$url" | jq . > /tmp/plc-samples/$DEVICE_ID/mod-$idx.json
  fi
done
```

- 输出：`/tmp/plc-samples/24/mod-7.json` 等，供后续定位 rows 的含义与数量。

## 3) 确认底图与灯位模板
- 底图（与示例一致，确保仿真效果）：
  - `src`: `http://192.168.0.101:9000/qiuqiu/微信图片_20251114114113_982_8.png`
  - `x`: 682.7040372799738, `y`: 7.8986575643110655, `width`: 197, `height`: 768
- 横向平移步长（每组向右移动的距离）：`stepX = 479`（与示例一致，可微调）
- 灯位偏移（相对底图左上角）。以下偏移来自已确认“第一组”的准确灯位：

```json
[
  { "dx": 45.2959627200262, "dy": 150.10134243568893 },
  { "dx": 44.2959627200262, "dy": 187.10134243568893 },
  { "dx": 45.2959627200262, "dy": 225.10134243568893 },
  { "dx": 44.2959627200262, "dy": 262.10134243568893 },
  { "dx": 45.2959627200262, "dy": 296.10134243568893 },
  { "dx": 44.2959627200262, "dy": 331.10134243568893 },
  { "dx": 44.2959627200262, "dy": 369.10134243568893 },
  { "dx": 45.2959627200262, "dy": 406.10134243568893 },
  { "dx": 45.2959627200262, "dy": 441.10134243568893 },
  { "dx": 46.2959627200262, "dy": 478.10134243568893 },
  { "dx": 46.2959627200262, "dy": 512.10134243568893 },
  { "dx": 46.2959627200262, "dy": 549.1013424356889 },
  { "dx": 45.2959627200262, "dy": 585.1013424356889 },
  { "dx": 46.2959627200262, "dy": 621.1013424356889 },
  { "dx": 48.2959627200262, "dy": 656.1013424356889 },
  { "dx": 46.2959627200262, "dy": 687.1013424356889 }
]
```

> 注：若某模块的 rows 数量与偏移数量不同，先按较小数量生成，剩余位置待补。

## 4) 生成规则（一致于示例 device_33 (2).json）
- front.layers：
  - 每个模块生成一组：先放底图（image），再放端口（port-adv）
  - 分组：`groupId = "mod-{moduleIndex}"`
  - 端口配置：
    - `apiId = "api-module-{moduleIndex}"`
    - `portDataKey = rows[i].registerAddressState`
    - `events.hover.dataKey = rows[i].registerDescribe`
    - `statusMapping.true.iconUrl = green.gif`，`false.iconUrl = null.png`
- front.apiList：为每个模块写入接口 URL
- back/detail：空视图占位

## 5) 我来执行（你确认 OK 后）
你把“模块列表”与“是否使用以上底图与偏移模板”告诉我，我会：
- 用 curl 探测每个模块 → 确认 rows 数量，抽样 rows[0..2] 给你确认含义
- 用现有脚本 `scripts/build-device-33.mjs` 模板化生成：
  - 修改 deviceId / 背景 / 偏移 / stepX / 模块索引集合
  - 输出 `apps/web-ele/设备示例/device_{deviceId}.json`（front/back/detail）
- 回填你指定的 deviceId（如 PLC5 的 ID）

## 6) 导入与验证
- 在 `/control/device-editor` → “导入JSON” 选择 `apps/web-ele/设备示例/device_{deviceId}.json`
- 预览 `/control/device-view/{deviceId}`，检查：
  - 每组（模块）的位置与底图贴合
  - 端口亮灭与后端状态一致
  - 分组功能可用（选择/复制/导出/编辑分组）

## 7) 备注与扩展
- 若每个模块底图不同：把每个模块的 background.src/x/y/width/height 列出来；我会按模块维度覆盖。
- 若需要完全从 DB 衍生：可先导出设备的 register_table 到 JSON，用 `scripts/generate-device-editor-json.mjs` 生成基础 front，然后套用本底图模板重排。
- 若需要最终“一键脚本”：我可以提供一个读配置（deviceId、模块列表、底图、偏移、stepX）的通用生成脚本，避免每次修改脚本源码。
