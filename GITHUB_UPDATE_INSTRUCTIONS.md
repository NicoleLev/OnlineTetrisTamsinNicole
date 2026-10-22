# GitHub HMM logging pilot update

These four files come from the instrumented Version A pilot. Upload them to the same directory in your existing GitHub Pages repository, replacing the files with the same names. **Do not delete any other repository files.**

Files: index.html, game.html, game.js, experiment.css.

Before replacing files, create a branch or download a backup. This package was prepared from the earlier uploaded integrated Version A build, **not fetched from your current GitHub HEAD**; replacing files may overwrite later changes. Compare changes first if the repository has advanced.

GitHub web UI: open the destination folder > Add file > Upload files > drag the four files > commit to a testing branch (or the Pages branch when ready). GitHub Pages may need time to publish.

Test with a dummy participant: automatic gravity, held Down, game over/restart, questionnaires, export; inspect events for `gravity_step`, `piece_spawn`, `downward_collision`, and metadata `hmm_logging_revision`. This is not yet validated for recruitment.
