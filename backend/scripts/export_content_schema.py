"""
Regenerate the JSON Schemas in content/schema/ from the content models
(src/infrastructure/content/schema.py). Run after changing a model:

    PYTHONPATH=. python scripts/export_content_schema.py
"""
import json
from pathlib import Path

from src.infrastructure.content.schema import CONTENT_KINDS

SINGULAR = {"heroes": "hero", "troops": "troop", "planets": "planet", "bosses": "boss"}


def main() -> None:
    out = Path(__file__).resolve().parent.parent / "content" / "schema"
    out.mkdir(parents=True, exist_ok=True)
    for kind, model in CONTENT_KINDS.items():
        schema = model.model_json_schema(by_alias=True)
        schema["$id"] = f"{SINGULAR[kind]}.schema.json"
        path = out / f"{SINGULAR[kind]}.schema.json"
        path.write_text(json.dumps(schema, indent=2) + "\n")
        print(f"wrote {path.relative_to(out.parent.parent)}")


if __name__ == "__main__":
    main()
