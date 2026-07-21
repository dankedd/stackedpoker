import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.solver_tree.importer import import_solve_tree

tree = {
    "node_type": "action_node", "player": 1,
    "actions": ["CHECK", "BET 2.000000"],
    "strategy": {"actions": ["CHECK", "BET 2.000000"], "strategy": {
        "AhKs": [0.7, 0.3], "QdQc": [0.5, 0.5],
    }},
    "childrens": {
        "CHECK": {
            "node_type": "action_node", "player": 0,
            "actions": ["CHECK", "BET 2.000000"],
            "strategy": {"actions": ["CHECK", "BET 2.000000"], "strategy": {"AhKs": [0.4, 0.6]}},
            "childrens": {
                "CHECK": {"node_type": "chance_node", "deal_number": 0,
                    "childrens": {
                        "Ts": {
                            "node_type": "action_node", "player": 1,
                            "actions": ["CHECK", "BET 4.000000"],
                            "strategy": {"actions": ["CHECK", "BET 4.000000"], "strategy": {"AhKs": [0.3, 0.7]}},
                            "childrens": {
                                "CHECK": {
                                    "node_type": "action_node", "player": 0,
                                    "actions": ["CHECK"],
                                    "strategy": {"actions": ["CHECK"], "strategy": {"AhKs": [1.0]}},
                                    "childrens": {
                                        "CHECK": {"node_type": "chance_node",
                                            "childrens": {
                                                "2c": {
                                                    "node_type": "action_node", "player": 1,
                                                    "actions": ["CHECK", "BET 8.000000"],
                                                    "strategy": {"actions": ["CHECK", "BET 8.000000"], "strategy": {"AhKs": [0.2, 0.8]}},
                                                    "childrens": {},
                                                },
                                            },
                                        },
                                    },
                                },
                                "BET 4.000000": {
                                    "node_type": "action_node", "player": 0,
                                    "actions": ["CALL", "FOLD"],
                                    "strategy": {"actions": ["CALL", "FOLD"], "strategy": {"AhKs": [0.6, 0.4]}},
                                    "childrens": {},
                                },
                            },
                        },
                    },
                },
                "BET 2.000000": {
                    "node_type": "action_node", "player": 1,
                    "actions": ["CALL", "FOLD"],
                    "strategy": {"actions": ["CALL", "FOLD"], "strategy": {"AhKs": [0.7, 0.3]}},
                    "childrens": {},
                },
            },
        },
        "BET 2.000000": {
            "node_type": "action_node", "player": 0,
            "actions": ["CALL", "FOLD"],
            "strategy": {"actions": ["CALL", "FOLD"], "strategy": {"AhKs": [0.5, 0.5]}},
            "childrens": {},
        },
    },
}

result = import_solve_tree(tree, "multi-street", ["Qh", "8c", "3d"], pot_size=6.5, effective_stack=96.8)
print(result.summary())
print()

by_street = {}
for n in result.nodes:
    by_street.setdefault(n.street, []).append(n)

for street in ["flop", "turn", "river"]:
    nodes = by_street.get(street, [])
    if not nodes:
        continue
    print(f"=== {street.upper()}: {len(nodes)} nodes ===")
    for n in nodes:
        par = n.parent_id[:10] if n.parent_id else "None"
        print(f"  id={n.id[:12]}  parent={par:12s}  path={n.action_path:20s}  actor={str(n.actor):4s}  board={n.board}  type={n.node_type}")
        if n.aggregate_freqs:
            print(f"    freqs: {n.aggregate_freqs}")
    print()

# Verify parent/child consistency
id_map = {n.id: n for n in result.nodes}
ok = True
for n in result.nodes:
    if n.parent_id and n.parent_id not in id_map:
        print(f"ERROR: {n.id[:8]} parent missing")
        ok = False
    for cid in n.children_ids:
        if cid not in id_map:
            print(f"ERROR: {n.id[:8]} child {cid[:8]} missing")
            ok = False
print(f"Parent/child: {'OK' if ok else 'BROKEN'}")
