# Motor-tests · UAV Propulsion Fit Lab

[在线工具 / Web app](https://ssybh2.github.io/Motor-tests/)

## 中文
浏览器本地运行的无人机动力系统拟合工具。支持直接上传 ZIP、DET 测试台文本型 `.xls`、CSV、TSV、TXT；可选择 RPM→推力、RPM→扭矩、PWM→RPM 等常见关系，也可自定义幂次，例如 `2`、`1,2`、`0,1,2`。输出拟合函数、R²、RMSE、残差图，并可导出 PDF/JSON。

数据只在浏览器本地处理，不上传到分析服务器。

## English
Browser-only UAV propulsion fitting tool. Upload ZIP, DET text-based `.xls`, CSV, TSV, or TXT files; choose common fits such as RPM→Thrust, RPM→Torque, and PWM→RPM, or define custom powers such as `2`, `1,2`, or `0,1,2`. Export equations, fit metrics, plots, PDF, and JSON.

Uploaded test data is processed locally in the browser.
