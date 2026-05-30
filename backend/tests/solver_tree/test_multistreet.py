"""Test multi-street tree traversal — flop → turn → river."""

from app.solver_tree.importer import import_solve_tree


def _multi_street_tree():
    """Simulated TexasSolver output with flop → turn → river."""
    return {
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
                    "CHECK": {
                        "node_type": "chance_node", "deal_number": 1,
                        "dealcards": {
                            "Ts": {
                                "node_type": "action_node", "player": 1,
                                "actions": ["CHECK", "BET 4.000000"],
                                "strategy": {"actions": ["CHECK", "BET 4.000000"], "strategy": {
                                    "AhKs": [0.3, 0.7],
                                }},
                                "childrens": {
                                    "CHECK": {
                                        "node_type": "action_node", "player": 0,
                                        "actions": ["CHECK"],
                                        "strategy": {"actions": ["CHECK"], "strategy": {"AhKs": [1.0]}},
                                        "childrens": {
                                            "CHECK": {
                                                "node_type": "chance_node",
                                                "deal_number": 1,
                                                "dealcards": {
                                                    "2c": {
                                                        "node_type": "action_node", "player": 1,
                                                        "actions": ["CHECK", "BET 8.000000"],
                                                        "strategy": {
                                                            "actions": ["CHECK", "BET 8.000000"],
                                                            "strategy": {"AhKs": [0.2, 0.8]},
                                                        },
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


class TestMultiStreetImport:
    def test_flop_turn_river_nodes_present(self):
        result = import_solve_tree(
            _multi_street_tree(), "ms-test", ["Qh", "8c", "3d"],
            pot_size=6.5, effective_stack=96.8,
        )
        streets = {n.street for n in result.nodes}
        assert "flop" in streets
        assert "turn" in streets
        assert "river" in streets

    def test_board_extends_on_street_change(self):
        result = import_solve_tree(
            _multi_street_tree(), "ms-test", ["Qh", "8c", "3d"],
            pot_size=6.5, effective_stack=96.8,
        )
        by_street = {}
        for n in result.nodes:
            by_street.setdefault(n.street, []).append(n)

        # Flop nodes have 3 cards
        for n in by_street["flop"]:
            assert n.board == ["Qh", "8c", "3d"], f"Flop node has wrong board: {n.board}"

        # Turn nodes have 4 cards (Ts dealt)
        for n in by_street["turn"]:
            assert len(n.board) == 4
            assert n.board[:3] == ["Qh", "8c", "3d"]
            assert n.board[3] == "Ts"

        # River nodes have 5 cards (2c dealt)
        for n in by_street["river"]:
            assert len(n.board) == 5
            assert n.board[:4] == ["Qh", "8c", "3d", "Ts"]
            assert n.board[4] == "2c"

    def test_node_ids_change_across_streets(self):
        result = import_solve_tree(
            _multi_street_tree(), "ms-test", ["Qh", "8c", "3d"],
            pot_size=6.5, effective_stack=96.8,
        )
        by_street = {}
        for n in result.nodes:
            by_street.setdefault(n.street, []).append(n)

        flop_ids = {n.id for n in by_street["flop"]}
        turn_ids = {n.id for n in by_street["turn"]}
        river_ids = {n.id for n in by_street["river"]}

        # No ID overlap between streets
        assert flop_ids.isdisjoint(turn_ids)
        assert turn_ids.isdisjoint(river_ids)
        assert flop_ids.isdisjoint(river_ids)

    def test_action_paths_grow_through_streets(self):
        result = import_solve_tree(
            _multi_street_tree(), "ms-test", ["Qh", "8c", "3d"],
            pot_size=6.5, effective_stack=96.8,
        )
        by_street = {}
        for n in result.nodes:
            by_street.setdefault(n.street, []).append(n)

        # Root flop node has empty path
        root = [n for n in by_street["flop"] if n.parent_id is None][0]
        assert root.action_path == ""

        # Turn nodes have paths through chance node
        for n in by_street["turn"]:
            assert len(n.action_history) > 0
            # Path includes the dealt card token
            assert "ts" in n.action_path.lower() or "Ts" in str(n.action_history)

        # River nodes have even longer paths
        for n in by_street["river"]:
            assert len(n.action_history) > len(by_street["turn"][0].action_history)

    def test_strategy_present_on_action_nodes(self):
        result = import_solve_tree(
            _multi_street_tree(), "ms-test", ["Qh", "8c", "3d"],
            pot_size=6.5, effective_stack=96.8,
        )
        action_nodes = [n for n in result.nodes if n.node_type == "action"]
        for n in action_nodes:
            assert n.combo_count > 0, f"Action node {n.human_path} has no combos"
            assert len(n.aggregate_freqs) > 0, f"Action node {n.human_path} has no freqs"

    def test_parent_child_chain_across_streets(self):
        result = import_solve_tree(
            _multi_street_tree(), "ms-test", ["Qh", "8c", "3d"],
            pot_size=6.5, effective_stack=96.8,
        )
        id_map = {n.id: n for n in result.nodes}

        # Find a river node and walk up to root
        river_nodes = [n for n in result.nodes if n.street == "river"]
        assert len(river_nodes) > 0

        node = river_nodes[0]
        chain = [node.street]
        while node.parent_id:
            node = id_map[node.parent_id]
            chain.append(node.street)

        # Should pass through river → turn → flop
        assert "river" in chain
        assert "turn" in chain
        assert "flop" in chain

    def test_total_node_count(self):
        result = import_solve_tree(
            _multi_street_tree(), "ms-test", ["Qh", "8c", "3d"],
            pot_size=6.5, effective_stack=96.8,
        )
        # Manual count: 7 action + 2 chance + some terminals
        assert result.total >= 9

    def test_print_tree_summary(self):
        """Not a real assertion — prints tree for manual inspection."""
        result = import_solve_tree(
            _multi_street_tree(), "ms-test", ["Qh", "8c", "3d"],
            pot_size=6.5, effective_stack=96.8,
        )
        print(f"\n{result.summary()}")

        by_street = {}
        for n in result.nodes:
            by_street.setdefault(n.street, []).append(n)

        for street in ["flop", "turn", "river"]:
            nodes = by_street.get(street, [])
            if not nodes:
                continue
            print(f"\n{street.upper()}: {len(nodes)} nodes")
            for n in nodes:
                par = n.parent_id[:8] if n.parent_id else "root"
                print(f"  {n.id[:8]} parent={par:8s} path={n.action_path:24s} actor={str(n.actor):4s} board={n.board} type={n.node_type}")
                if n.aggregate_freqs:
                    print(f"           freqs={n.aggregate_freqs}")
