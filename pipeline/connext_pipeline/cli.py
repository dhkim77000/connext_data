"""CLI: run a scraper against one account and print each record as a JSON line.

Examples
--------
Run one data type::

    python -m connext_pipeline.cli instagram --ig-user-id 17841... --data-type profile

Run every data type the scraper supports::

    python -m connext_pipeline.cli instagram --ig-user-id 17841...

The token and id may instead come from ``IG_ACCESS_TOKEN`` / ``IG_USER_ID`` (a local
``.env`` is loaded automatically). Records go to **stdout** (one JSON object per line);
progress goes to **stderr** -- so ``... | jq`` just works.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from typing import Optional, Sequence

from dotenv import load_dotenv

from .graph.client import GraphClient
from .scrapers.base import BaseScraper
from .scrapers.instagram import InstagramScraper

#: ``connector_id`` -> scraper class. Register new channels here.
SCRAPERS: dict[str, type[BaseScraper]] = {InstagramScraper.connector_id: InstagramScraper}


def main(argv: Optional[Sequence[str]] = None) -> int:
    """Parse arguments, run the selected scraper, and print its records.

    Parameters
    ----------
    argv : Sequence[str], optional
        Argument vector (defaults to ``sys.argv[1:]``).

    Returns
    -------
    int
        Process exit code (0 on success).
    """
    load_dotenv()
    parser = argparse.ArgumentParser(
        prog="connext-pipeline",
        description="Run a channel scraper and print records as JSON lines.",
    )
    parser.add_argument("connector", choices=sorted(SCRAPERS), help="connector id (e.g. instagram)")
    parser.add_argument("--token", default=os.getenv("IG_ACCESS_TOKEN"), help="access token (or env IG_ACCESS_TOKEN)")
    parser.add_argument("--ig-user-id", default=os.getenv("IG_USER_ID"), help="Instagram user id (or env IG_USER_ID)")
    parser.add_argument("--data-type", help="a single data_type to run (default: all of them)")
    parser.add_argument("--limit", type=int, default=5, help="max media rows to print (default 5; 0 = all)")
    parser.add_argument("-v", "--verbose", action="store_true", help="debug logging")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )
    if not args.token:
        parser.error("an access token is required (--token or IG_ACCESS_TOKEN)")

    scraper_cls = SCRAPERS[args.connector]
    with GraphClient(args.token) as client:
        scraper = scraper_cls(client)
        data_types = [args.data_type] if args.data_type else list(scraper.data_types)
        for data_type in data_types:
            print(f"# === {args.connector}:{data_type} ===", file=sys.stderr)
            count = 0
            try:
                for row in scraper.scrape(data_type, ig_user_id=args.ig_user_id):
                    print(json.dumps(row, ensure_ascii=False))
                    count += 1
                    if args.limit and data_type in ("media", "media_insights") and count >= args.limit:
                        break
            except Exception as exc:  # noqa: BLE001 -- top-level runner: surface and move on
                print(f"# ERROR on {data_type}: {exc}", file=sys.stderr)
                continue
            print(f"# {count} rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
