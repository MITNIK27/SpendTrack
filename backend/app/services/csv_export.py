import csv
import io
from collections.abc import Iterable
from typing import Any

from fastapi.responses import StreamingResponse


def csv_response(*, filename: str, header: list[str], rows: Iterable[list[Any]]) -> StreamingResponse:
    """Builds a text/csv download from a header row and data rows. Plain stdlib
    csv — no charting/spreadsheet dependency needed for something Excel opens natively."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
