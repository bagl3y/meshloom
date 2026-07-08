---
name: Bug report / Feature request
about: Report a problem or request a feature for RemoteTerm for MeshCore
title: ''
labels: ''
assignees: ''
---

## 📝 Problem Description
<!-- A clear description of the bug or the feature you'd like. -->

## 🚦 Current Behavior
<!-- What actually happens today. For feature requests, describe the current limitation. -->

## 🎯 Expected Behavior
<!-- What you expected to happen instead. -->

## 📋 Steps to Reproduce
<!-- If it's a bug, how can we reproduce it? -->
1.
2.
3.

## 📡 Radio Node
<!-- The MeshCore radio RemoteTerm is talking to. -->
- **Firmware version:** <!-- e.g. 1.15.0 -->
- **Hardware / board type:** <!-- e.g. Heltec V3, RAK4631, T-Deck -->

## 🔌 Connection to the Radio
- **Connected directly to the radio, or through an intermediary?**
  <!-- Direct is the only officially supported path. If you use an intermediary
       companion/frameserver such as pyMC / OpenHop, please say so — many issues
       are specific to those and won't reproduce on a direct connection. -->
- **Transport:** <!-- Serial / TCP / BLE -->

## 💻 Environment Information
- **OS:** <!-- e.g. macOS 15, Windows 11, Raspberry Pi OS -->
- **Browser / Version:** <!-- e.g. Chrome 150, Safari 18 -->
- **RemoteTerm Version:** <!-- e.g. v3.15.2, or "wrapped" HA add-on -->

## 📸 Screenshots / Debug Logs
<!-- Screenshots are great. For bugs, a debug snapshot or debug-level logs help enormously. -->

<details>
<summary><b>How to attach debug information</b> (please read — it speeds up diagnosis a lot)</summary>

**Easiest — debug support snapshot (recommended for everyone):**
In the app, go to **Settings → About → "Open debug support snapshot"** (or navigate to
`/api/debug`). Copy the block and paste it here.

> 🔒 The snapshot includes recent logs and basic environment/radio status. It never
> exposes your private key. Logs *may* contain channel names or keys. If you'd rather
> not share those, copy only **up to the `STOP COPYING HERE` marker** — everything
> above it reveals nothing sensitive beyond your bot names.

**Advanced — full debug-level logs:**
Restart the backend with debug logging enabled to capture detailed radio
communication and packet processing:
```bash
MESHCORE_LOG_LEVEL=DEBUG uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Then reproduce the issue and paste the relevant log output.

</details>

---
**Additional context**
<!-- Anything else that might help. -->
