"""
realtime — low-latency intelligence layer for live coaching and simulation.

This package adds real-time capabilities to the platform:
  - WebSocket connections for live data streaming
  - Redis pub/sub for distributed event broadcasting
  - Action-by-action analysis with incremental state updates
  - Live session copilot with rolling summaries
  - Interactive scenario simulation (what-if analysis)
  - Compliance safeguards preventing unethical live assistance

Modules:
  events.py       — Redis pub/sub event bus for distributed broadcasting
  ws.py           — WebSocket connection manager and message routing
  engine.py       — Realtime analysis engine (per-action processing)
  session.py      — Live session copilot (tracking, recaps, leak detection)
  simulation.py   — Interactive scenario trees and what-if analysis
  compliance.py   — Ethical safeguards, delayed mode, anti-RTA controls
"""
