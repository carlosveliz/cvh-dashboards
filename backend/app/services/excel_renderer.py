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


def _build_chart(df: pd.DataFrame) -> dict[str, Any] | None:
    """Heuristic: first text column = category, numeric columns = series."""
    if df.empty:
        return None
    text_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c])]
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    if not text_cols or not numeric_cols:
        return None
    category = text_cols[0]
    series = numeric_cols[:4]
    sample = df.head(50)
    data = []
    for _, row in sample.iterrows():
        point: dict[str, Any] = {"category": _clean_value(row[category])}
        for s in series:
            point[str(s)] = _clean_value(row[s])
        data.append(point)
    return {"category": str(category), "series": [str(s) for s in series], "data": data}


def render_excel(data: bytes) -> ExcelData:
    sheets_dict = pd.read_excel(io.BytesIO(data), sheet_name=None, engine="openpyxl")
    sheets: list[ExcelSheet] = []
    for name, df in sheets_dict.items():
        df = df.where(pd.notnull(df), None)
        truncated = df.head(MAX_ROWS_PER_SHEET)
        columns = [str(c) for c in truncated.columns]
        rows = [[_clean_value(v) for v in row] for row in truncated.itertuples(index=False, name=None)]
        sheets.append(
            ExcelSheet(
                name=str(name),
                columns=columns,
                rows=rows,
                chart=_build_chart(truncated),
            )
        )
    return ExcelData(sheets=sheets)
