"""Base class shared by every channel scraper."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Iterator

from ..graph.client import GraphClient


class BaseScraper(ABC):
    """Common surface for every channel scraper.

    A scraper turns one connected account (one credential) into batches of typed records,
    one batch per ``data_type``. It performs **no persistence** -- the caller (the CLI
    today, the sync worker later) decides what to do with the rows. Keeping the scraping
    layer side-effect free is what lets the same code run in local runs, tests and the
    pipeline. New channels subclass this and set :attr:`connector_id` / :attr:`data_types`.

    Parameters
    ----------
    client : GraphClient
        A client already bound to the account's access token.

    Attributes
    ----------
    connector_id : str
        Stable id matching ``channel_connections.connector_id`` (e.g. ``"instagram"``).
    data_types : tuple of str
        The ``data_type`` values this scraper can produce.
    """

    connector_id: str = ""
    data_types: tuple[str, ...] = ()

    def __init__(self, client: GraphClient) -> None:
        self.client = client

    @abstractmethod
    def scrape(self, data_type: str, **kwargs: Any) -> Iterator[dict]:
        """Yield records for one ``data_type``.

        Parameters
        ----------
        data_type : str
            One of :attr:`data_types`.
        **kwargs : Any
            Channel-specific arguments (account ids, time windows, ...).

        Yields
        ------
        dict
            One record, already flattened to a warehouse-friendly shape.

        Raises
        ------
        ValueError
            When ``data_type`` is not supported or required arguments are missing.
        """
        raise NotImplementedError
