"""Allow running as: python -m app.texassolver.generate"""

import sys

from .generate import main

sys.exit(main())
