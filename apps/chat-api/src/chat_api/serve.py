from pathlib import Path
import os
import sys
import uvicorn
from dotenv import load_dotenv


def main() -> None:
    load_dotenv()

    src_dir = Path(__file__).resolve().parents[1]
    if str(src_dir) not in sys.path:
        sys.path.insert(0, str(src_dir))

    port_text = os.getenv("API_PORT", "8000")
    try:
        port = int(port_text)
    except ValueError:
        port = 8000

    uvicorn.run("chat_api.main:app", host="127.0.0.1", port=port, reload=True)


if __name__ == "__main__":
    main()
