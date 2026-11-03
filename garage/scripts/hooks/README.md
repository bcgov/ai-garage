# Garage — local implement guard (Cursor hooks)

Optional **beforeFileEdit** hook that blocks agent edits to protected paths during **implementation** sessions. Spec/plan work lifts the guard with `GARAGE_ALLOW_SPEC_EDIT=1` (see `.github/garage/OPERATE.md`).

## Protected paths

- `spec/features/**`
- `.github/workflows/**`
- `.github/garage/**`
- `constitution.md`
- `garage.config.json`

## Install (once per clone)

From the enrolled service repo root:

```bash
mkdir -p .cursor/hooks
cp .github/garage/hooks/implement-guard.sh .cursor/hooks/
chmod +x .cursor/hooks/implement-guard.sh
```

Merge the hook entry into `.cursor/hooks.json` (create the file if missing):

```json
{
  "version": 1,
  "hooks": {
    "beforeFileEdit": [{ "command": ".cursor/hooks/implement-guard.sh" }]
  }
}
```

If you already have hooks, add the `beforeFileEdit` array entry without removing other events. See `hooks.json.example` in this directory.

Reload Cursor (or save `hooks.json`) and confirm the hook appears under **Cursor Settings → Hooks**.

## Session modes

| Mode | Env | Behaviour |
| --- | --- | --- |
| **Implementation** (default) | unset | Blocks protected paths |
| **Spec / plan** | `GARAGE_ALLOW_SPEC_EDIT=1` | Allows all paths |

Example spec session:

```bash
export GARAGE_ALLOW_SPEC_EDIT=1
# start your local coding agent in this shell
```

## Manual test

```bash
echo '{"file_path":"spec/features/example.feature"}' | .cursor/hooks/implement-guard.sh
# exit 2 + message

echo '{"file_path":"spec/features/example.feature"}' | GARAGE_ALLOW_SPEC_EDIT=1 .cursor/hooks/implement-guard.sh
# exit 0
```

## References

- Pack ops: `.github/garage/OPERATE.md`
- Cursor hooks: [create-hook skill](https://cursor.com/docs) / project `.cursor/hooks.json`
