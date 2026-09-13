# Motor-tests · UAV Propulsion Fit Lab

**在线工具 / Web app:** https://ssybh2.github.io/Motor-tests/

当前在线界面：**UI v2.6**

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

### 推荐桌面环境

- Windows 10 / Windows 11
- Microsoft Edge（推荐）
- Google Chrome

UI v2.6 针对 Windows 桌面进行了重新适配，并对浏览器极端缩小的站点缩放进行自动补偿。X/Y 数据列使用可搜索的大字体下拉面板，便于 DET 数据字段较多时选择。

## English

Browser-only UAV propulsion fitting tool. Upload ZIP, DET text-based `.xls`, CSV, TSV, or TXT files; configure explicit X/Y axes, units, symbols, and selectable model terms; then export equations, metrics, plots, PDF, and JSON.

The current UI is **v2.6**, optimized for Windows desktop browsers. Uploaded test data is processed locally in the browser.
