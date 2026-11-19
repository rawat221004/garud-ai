# Dataset provenance

This repository includes the team's [fictional Hyderabad flood scenario](simulated/hyderabad_flood_scenario.json) for a reproducible demo. Its weather values and incident reports are synthetic.

The app retrieves current data from public provider endpoints. See [DATASET_SOURCES.md](DATASET_SOURCES.md) for endpoints, attribution, transformations and the snapshot inventory used for the original hackathon submission. Third-party snapshots and historical reanalysis are fetched separately.

After installing the backend dependencies, run from the repository root:

```powershell
backend\.venv\Scripts\python.exe scripts\fetch_datasets.py
```

The script creates `live_samples/` and `historical/` with retrieval metadata where supported. Check the providers' access, attribution and redistribution terms before sharing the downloaded files.
