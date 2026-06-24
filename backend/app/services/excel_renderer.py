import io
import math
from typing import Any

import pandas as pd

from ..schemas.dashboard import ExcelData, ExcelSheet

MAX_ROWS_PER_SHEET = 2000


def _clean_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, (int, bool, str)):
        return value
    # Timestamps, etc. -> string
    return str(value)


def _chart_from_columns(
    df: pd.DataFrame, category: str, series: list[str], chart_type: str
) -> dict[str, Any] | None:
    """Build a chart from explicit columns (validated against the dataframe)."""
    if df.empty or category not in df.columns:
        return None
    series = [s for s in series if s in df.columns]
    if not series:
        return None
    sample = df.head(50)
    data = []
    for _, row in sample.iterrows():
        point: dict[str, Any] = {"category": _clean_value(row[category])}
        for s in series:
            point[str(s)] = _clean_value(row[s])
        data.append(point)
    return {
        "type": chart_type,
        "category": str(category),
        "series": [str(s) for s in series],
        "data": data,
    }


def _build_chart(df: pd.DataFrame) -> dict[str, Any] | None:
    """Heuristic: first text column = category, numeric columns = series."""
    if df.empty:
        return None
    text_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c])]
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    if not text_cols or not numeric_cols:
        return None
    return _chart_from_columns(df, text_cols[0], list(numeric_cols[:4]), "bar")


def render_excel(data: bytes, config: dict[str, Any] | None = None) -> ExcelData:
    """Render every sheet to columns+rows, plus a chart per sheet.

    If `config` is given ({sheet, chart_type, category, series}), the named sheet
    uses that explicit chart (chart_type 'none' = no chart); all other sheets and
    any invalid config fall back to the heuristic."""
    sheets_dict = pd.read_excel(io.BytesIO(data), sheet_name=None, engine="openpyxl")
    cfg_sheet = (config or {}).get("sheet")
    sheets: list[ExcelSheet] = []
    for name, df in sheets_dict.items():
        df = df.where(pd.notnull(df), None)
        truncated = df.head(MAX_ROWS_PER_SHEET)
        columns = [str(c) for c in truncated.columns]
        rows = [[_clean_value(v) for v in row] for row in truncated.itertuples(index=False, name=None)]

        if config and str(name) == str(cfg_sheet):
            ctype = config.get("chart_type", "bar")
            if ctype == "none":
                chart = None
            else:
                chart = _chart_from_columns(
                    truncated,
                    config.get("category", ""),
                    list(config.get("series", [])),
                    ctype,
                ) or _build_chart(truncated)
        else:
            chart = _build_chart(truncated)

        sheets.append(
            ExcelSheet(name=str(name), columns=columns, rows=rows, chart=chart)
        )
    return ExcelData(sheets=sheets)
