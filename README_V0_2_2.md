# Meta-T v0.2.2
Changes from validated v0.2.1:
- Holding ArrowDown continuously soft-drops (50 ms controlled repeat); release stops it.
- A normal ArrowDown press still soft-drops immediately.
- condition_summary.csv adds condition duration, left/right moves, rotations, soft drops,
  challenge/frustration ratings, and start/end timestamps.
- Separate raw events and ratings.csv are retained.
Everything else (consent, PPT ID, Drive endpoint, no ghost, disabled hard drop,
next preview, top-out restart, fixed condition speeds) is preserved.
