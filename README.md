# Motor-tests · UAV Propulsion Fit Lab

**在线工具 / Web app:** https://ssybh2.github.io/Motor-tests/

当前在线界面：**UI v2.7**

## 中文

浏览器本地运行的无人机动力系统测试数据拟合工具。支持直接上传 ZIP、DET 测试台文本型 `.xls`、CSV、TSV、TXT，并可配置多组拟合任务。

主要功能：

- 明确选择横轴 X 与纵轴 Y，并分别设置名称、数学符号和单位。
- 支持 RPM→推力、RPM→扭矩、RPM→功率、PWM→RPM 等常见模板，也可完全自定义。
- 模型项可逐项启用/关闭；关闭后该系数固定为 0。例如只启用二次项即可拟合纯平方模型。
- 系数输入使用普通文本，例如 `K_T2`；数学预览自动渲染为 `K_{T2}`。
- 公式中变量与系数使用明确的点乘符号 `·`。
- 自动推导系数单位，并可自定义 X/Y 单位。
- 输出 R²、Adjusted R²、RMSE、MAE、最大绝对误差、拟合曲线与残差图。
- 支持导出 PDF 和 JSON。
- 数据只在当前浏览器本地处理，不上传到分析服务器。

### UI v2.7

v2.7 参考 `EcatV2_Master` 的在线 TaskEditor 设计语言重做桌面布局：

- 使用居中的 **1480 px 工程工作区**，避免内容挤在屏幕左侧。
- 使用白色 sticky topbar、浅灰工程背景、统一 18 px 卡片、柔和阴影和清晰的 section hierarchy。
- 增加 01 / 02 / 03 工作流导航，对应 Data / Configure Fits / Results。
- X/Y 数据列使用可搜索的大字体下拉面板，适合字段较多的 DET 数据。
- **彻底移除浏览器 zoom / scale 自动补偿逻辑**。网页现在完全依赖标准响应式 CSS，不再猜测 Windows/Edge 的缩放比例。

### 推荐桌面环境

- Windows 10 / Windows 11
- Microsoft Edge（推荐）
- Google Chrome

如果浏览器仍显示旧版本，请使用 `Ctrl + F5` 强制刷新缓存。

## English

Browser-only UAV propulsion fitting tool. Upload ZIP, DET text-based `.xls`, CSV, TSV, or TXT files; configure explicit X/Y axes, units, symbols, and selectable model terms; then export equations, metrics, plots, PDF, and JSON.

The current UI is **v2.7**, using a centered TaskEditor-inspired engineering workspace and standard responsive CSS without browser zoom compensation. Uploaded test data is processed locally in the browser.
