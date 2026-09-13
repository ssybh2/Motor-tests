# Motor-tests — UAV Propulsion Fit Lab

A browser-only fitting workbench for UAV propulsion-system test data.

## What it does

- Load `.zip`, `.csv`, `.tsv`, or `.txt` test data locally in the browser.
- Automatically unpack ZIP archives and discover tabular files.
- Select one table or merge all discovered tables.
- Create multiple fitting jobs in one session.
- Use common UAV propulsion presets such as RPM→Thrust, RPM→Torque, RPM→Power, PWM/Throttle→RPM, PWM/Throttle→Thrust, Current→Torque, RPM→Current, Voltage→RPM, J→CT, and J→CP.
- Customize power-basis terms directly, e.g.:
  - `2` → `y = a·x²`
  - `1,2` → `y = a·x + b·x²`
  - `0,1,2` → `y = a₀ + a₁·x + a₂·x²`
  - arbitrary real powers such as `0,0.5,1,2,-1` are supported when mathematically valid for the input data.
- Restrict the fitting range with optional X minimum/maximum values.
- Inspect R², adjusted R², RMSE, MAE, maximum absolute error, fitted coefficients, fitting plots, and residual plots.
- Export a concise PDF report with equations, metrics, coefficient tables, fitting plots, and residual plots.
- Export machine-readable JSON results.

## Privacy

All archive extraction, parsing, fitting, plotting, and report generation happens in your browser. Test data is not uploaded to a fitting server.

## Run locally

Because this is a static site, you can either open `index.html` directly or serve the repository folder with any static HTTP server.

For example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish with GitHub Pages

This repository is already structured as a static site at the repository root. No build step is required.

In GitHub:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **main** and folder **/(root)**.
4. Save.

After GitHub publishes it, the expected site URL is:

`https://ssybh2.github.io/Motor-tests/`

## Input data

The app works best with a header row and numeric columns, for example:

```csv
PWM,RPM,Thrust_N,Torque_Nm,Voltage_V,Current_A
1100,2200,0.31,0.012,24.8,2.1
1200,3900,0.94,0.031,24.6,4.0
1300,5600,1.88,0.058,24.3,7.2
```

Rows with missing/non-numeric values in the selected X or Y columns are skipped automatically. A small synthetic example is included at `sample_data/motor_test_example.csv` so the complete workflow can be tested immediately.

## Fitting implementation

Version 1 uses ordinary least squares over a user-selected real-valued power basis. The least-squares solver uses column scaling and QR orthogonalization instead of directly inverting the normal equations, which improves numerical behavior for large RPM values and correlated polynomial terms.

The generalized model is:

```text
y = Σ a_k x^(p_k)
```

where every exponent `p_k` is selected by the user. This means physically constrained models such as `T = k_T·RPM²` and empirical models with linear/constant terms are handled by the same fitting engine.

## Browser dependencies

The static page loads JSZip, Papa Parse, Plotly, html2canvas, and jsPDF from public CDNs. An internet connection is therefore required when opening the hosted page.
