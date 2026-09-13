# Motor-tests — UAV Propulsion Fit Lab

A browser-only fitting workbench for UAV propulsion-system test data.

## What it does

- Load `.zip`, `.csv`, `.tsv`, or `.txt` test data locally in the browser.
- Automatically unpack ZIP archives and discover tabular files.
- Select a data file or merge all discovered tables.
- Create multiple fitting jobs in one session.
- Use common UAV propulsion presets such as RPM→Thrust, RPM→Torque, PWM/Throttle→RPM, Current→Torque, J→CT, and J→CP.
- Customize polynomial/power basis terms directly, e.g.:
  - `2` → `y = a·x²`
  - `1,2` → `y = a·x + b·x²`
  - `0,1,2` → `y = a₀ + a₁·x + a₂·x²`
  - arbitrary real powers such as `0,0.5,1,2,-1` are supported when mathematically valid for the input data.
- Inspect R², adjusted R², RMSE, MAE, maximum absolute error, residual plots, and fitted coefficients.
- Export a concise PDF report with fitted equations, metrics, coefficient tables, and plots.
- Export machine-readable JSON results.

## Privacy

All parsing, fitting, plotting, and report generation happens in your browser. Test data is not uploaded to a fitting server.

## Run locally

Because this is a static site, you can either open `index.html` directly or serve the repository folder with any static HTTP server.

For example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

The included GitHub Actions workflow deploys the repository root to GitHub Pages. If Pages is not already enabled for the repository, open **Settings → Pages** and select **GitHub Actions** as the source, then re-run the workflow.

## Input data

The app works best with a header row and numeric columns, for example:

```csv
PWM,RPM,Thrust_N,Torque_Nm,Voltage_V,Current_A
1100,2200,0.31,0.012,24.8,2.1
1200,3900,0.94,0.031,24.6,4.0
1300,5600,1.88,0.058,24.3,7.2
```

Rows with missing/non-numeric values in the selected X or Y columns are skipped automatically.

## Notes

Version 1 uses ordinary least squares over a user-selected power basis. It is intentionally general so physically constrained models such as `T = k_T ω²` and unconstrained quadratic models can both be represented without separate fitting engines.
