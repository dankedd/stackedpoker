"""Quick script to analyze solve tree structure and test multi-street traversal."""
import json
import os
import sys
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def analyze_raw_tree():
    """Analyze the raw TexasSolver JSON output for tree structure."""
    # Find the latest solve output
    base = "C:/data/solves/output"
    if not os.path.exists(base):
        print("No solve output directory")
        return None

    latest = None
    for d in sorted(os.listdir(base)):
        p = os.path.join(base, d, "solve_output.json")
        if os.path.exists(p):
            latest = p

    if not latest:
        print("No solve outputs found")
        return None

    size = os.path.getsize(latest)
    print(f"File: {latest}")
    print(f"Size: {size / 1024:.1f} KB")

    with open(latest) as f:
        data = json.load(f)

    print(f"Root type: {data.get('node_type')}")
    print(f"Root actions: {data.get('actions')}")
    print(f"Root children: {list(data.get('childrens', {}).keys())}")

    # Count all nodes
    def count(n, depth=0):
        if not isinstance(n, dict):
            return 0, depth
        total = 1
        md = depth
        for c in n.get("childrens", {}).values():
            t, dd = count(c, depth + 1)
            total += t
            md = max(md, dd)
        return total, md

    t, mx = count(data)
    print(f"Total nodes: {t}, max depth: {mx}")

    # Find chance nodes (street transitions)
    chance_paths = []

    def find_chance(n, path="root"):
        if not isinstance(n, dict):
            return
        if n.get("node_type") == "chance_node":
            ch = n.get("childrens", {})
            chance_paths.append((path, len(ch), list(ch.keys())[:3]))
        for name, child in n.get("childrens", {}).items():
            find_chance(child, f"{path}/{name[:12]}")

    find_chance(data)
    print(f"\nChance nodes: {len(chance_paths)}")
    for path, nch, keys in chance_paths[:5]:
        print(f"  {path}: {nch} children, sample={keys}")

    # Show tree at depth 0-3
    print("\n--- Tree structure (depth 0-3) ---")

    def show(n, label="root", depth=0):
        if depth > 3 or not isinstance(n, dict):
            return
        nt = n.get("node_type", "?")
        p = n.get("player", "?")
        acts = n.get("actions", [])
        ch_keys = list(n.get("childrens", {}).keys())
        combos = len(n.get("strategy", {}).get("strategy", {})) if isinstance(n.get("strategy"), dict) else 0
        print(f"{'  ' * depth}{label}: {nt} p={p} acts={[a[:12] for a in acts]} ch={[c[:12] for c in ch_keys]} combos={combos}")
        for name, child in n.get("childrens", {}).items():
            show(child, name[:15], depth + 1)

    show(data)

    return latest


def test_tree_import():
    """Import tree and verify multi-street nodes."""
    from app.solver_tree.importer import import_solve_tree

    base = "C:/data/solves/output"
    latest = None
    for d in sorted(os.listdir(base)):
        p = os.path.join(base, d, "solve_output.json")
        if os.path.exists(p):
            latest = (d, p)

    if not latest:
        print("No solve outputs")
        return

    job_id, path = latest
    with open(path) as f:
        data = json.load(f)

    result = import_solve_tree(
        data, job_id, ["Qh", "8c", "3d"], pot_size=6.5, effective_stack=96.8,
    )

    print(f"\n--- Tree Import Result ---")
    print(result.summary())

    # Show all nodes grouped by street
    by_street = {}
    for node in result.nodes:
        by_street.setdefault(node.street, []).append(node)

    for street in ["preflop", "flop", "turn", "river"]:
        nodes = by_street.get(street, [])
        if nodes:
            print(f"\n{street.upper()}: {len(nodes)} nodes")
            for n in nodes[:3]:
                print(f"  id={n.id[:10]} parent={n.parent_id[:10] if n.parent_id else 'None'}")
                print(f"    path={n.action_path} actor={n.actor} board={n.board}")
                print(f"    type={n.node_type} actions={n.available_actions}")
                if n.aggregate_freqs:
                    print(f"    freqs={n.aggregate_freqs}")

    # Verify parent/child consistency
    id_map = {n.id: n for n in result.nodes}
    errors = 0
    for node in result.nodes:
        if node.parent_id and node.parent_id not in id_map:
            print(f"  ERROR: node {node.id[:8]} parent {node.parent_id[:8]} not found")
            errors += 1
        for cid in node.children_ids:
            if cid not in id_map:
                print(f"  ERROR: node {node.id[:8]} child {cid[:8]} not found")
                errors += 1

    print(f"\nParent/child consistency: {'OK' if errors == 0 else f'{errors} errors'}")


if __name__ == "__main__":
    analyze_raw_tree()
    print("\n" + "=" * 60 + "\n")
    test_tree_import()
