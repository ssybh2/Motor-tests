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

### UI v2.7 桌面工作台

v2.7 参考 `EcatV2_Master` 的在线 TaskEditor 设计语言，并针对 Windows / Edge 的实际使用继续优化：

- 工作区直接使用浏览器可见宽度，不再受固定 `1480px` 上限影响，因此即使 Edge 为该站点保存了较小的页面缩放，主工作区也不会缩成屏幕中央的一小块。
- 不对整个网页使用 CSS `zoom` 或 `transform: scale()`。脚本只根据浏览器窗口与站点缩放的比例调整字体、控件高度、间距和图表字号，避免过去出现的“全部内容挤在左边”问题。
- 每个拟合任务现在是一个 **左右分栏工作台**：左侧配置 Dataset / Preset / X / Y / 单位 / 模型项 / 拟合范围；点击“运行此任务”后，该任务自己的公式、误差指标、系数表、拟合曲线和残差图直接显示在右侧。
- “运行全部拟合”会把每个结果分别放回对应任务的右侧，不再把所有图堆到页面最下面。
- 页面底部 Results 区域现在主要用于显示运行状态以及导出 JSON / PDF。
- X/Y 数据列继续使用可搜索的大字体下拉面板，适合字段较多的 DET 数据。

### 推荐桌面环境

- Windows 10 / Windows 11
- Microsoft Edge（推荐）
- Google Chrome

如果浏览器仍显示旧缓存，请使用 `Ctrl + F5` 强制刷新。

## English

Browser-only UAV propulsion fitting tool. Upload ZIP, DET text-based `.xls`, CSV, TSV, or TXT files; configure explicit X/Y axes, units, symbols, and selectable model terms; then export equations, metrics, plots, PDF, and JSON.

The current **UI v2.7** uses a viewport-wide TaskEditor-inspired workspace. Each fit task has configuration on the left and its own equation, metrics, fit plot, and residual plot on the right after execution. The UI compensates very small Edge/Chrome per-site zoom by scaling interface dimensions only; it never zooms or transforms the whole application. Uploaded test data is processed locally in the browser.
