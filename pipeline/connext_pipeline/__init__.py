"""connext data pipeline — scraping, cleaning, and analysis (Instagram first).

This package is the Python half of connext: it collects raw data from each connected
channel's API, and will later clean and analyse it. Scraping is deliberately separated
from loading so the same code runs in local runs, tests, and the scheduled sync.
"""

__version__ = "0.1.0"
