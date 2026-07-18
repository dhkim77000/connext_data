"""Channel scrapers. Each turns one connected account into typed record batches."""

from .base import BaseScraper
from .instagram import InstagramScraper

__all__ = ["BaseScraper", "InstagramScraper"]
