# Meta-T v0.2.4 — Soft-Drop Telemetry

Built directly from the working v0.2.3 build.

Telemetry refinement only:
- `soft_drop_start` = physical ArrowDown press begins a soft-drop action
- `soft_drop` with `input_mode: initial_press` = first row moved by that press
- `soft_drop_repeat` with `input_mode: held` = each additional row moved while ArrowDown remains held
- `soft_drop_end` = physical ArrowDown release

The continuous soft-drop mechanics themselves are unchanged.

Preserved from v0.2.3:
- no play-area grid
- hold ArrowDown continuous soft drop
- expanded condition summary
- consent + PPT participant ID
- Google Drive checkpointing
- next-piece preview
- no ghost
- hard drop disabled
- automatic game-over/restart
- fixed condition-controlled falling speeds
