import random
from typing import List, Optional

from src.domain.entities.expedition_run import MapNode
from src.domain.value_objects.enums import NodeType

MAP_ROWS = 7       # row 0 = landing zone, last row = boss
MAP_WIDTH = 3

# Weighted node pools per depth band (middle rows only).
_ROW_POOLS = {
    1: [(NodeType.COMBAT, 1.0)],
    2: [(NodeType.COMBAT, 0.50), (NodeType.CACHE, 0.15), (NodeType.ARCHIVE, 0.15), (NodeType.ELITE, 0.20)],
    3: [(NodeType.COMBAT, 0.40), (NodeType.ELITE, 0.20), (NodeType.REST, 0.25), (NodeType.ARCHIVE, 0.15)],
    4: [(NodeType.COMBAT, 0.45), (NodeType.ELITE, 0.25), (NodeType.CACHE, 0.15), (NodeType.ARCHIVE, 0.15)],
    5: [(NodeType.REST, 0.40), (NodeType.COMBAT, 0.30), (NodeType.CACHE, 0.15), (NodeType.ARCHIVE, 0.15)],
}


class MapGenerator:
    """Builds a branching planet map: START → 5 rows of 3 nodes → BOSS. Paths never dead-end."""

    def __init__(self, rng: Optional[random.Random] = None):
        self.rng = rng or random.Random()

    def generate(self) -> List[MapNode]:
        rows: List[List[MapNode]] = []
        rows.append([MapNode(id="n0_1", row=0, col=1, type=NodeType.START, visited=True, threat=0)])

        for r in range(1, MAP_ROWS - 1):
            row_nodes = [
                MapNode(id=f"n{r}_{c}", row=r, col=c, type=self._roll_type(r), threat=r)
                for c in range(MAP_WIDTH)
            ]
            if not any(n.type in (NodeType.COMBAT, NodeType.ELITE) for n in row_nodes):
                row_nodes[self.rng.randrange(MAP_WIDTH)].type = NodeType.COMBAT
            rows.append(row_nodes)

        rows.append([MapNode(id=f"n{MAP_ROWS - 1}_1", row=MAP_ROWS - 1, col=1, type=NodeType.BOSS, threat=MAP_ROWS - 1)])

        # Edges
        rows[0][0].next_ids = [n.id for n in rows[1]]
        for r in range(1, MAP_ROWS - 2):
            for node in rows[r]:
                targets = {node.col}  # straight path guarantees every node is reachable
                options = [c for c in (node.col - 1, node.col + 1) if 0 <= c < MAP_WIDTH]
                if options and self.rng.random() < 0.7:
                    targets.add(self.rng.choice(options))
                node.next_ids = [f"n{r + 1}_{c}" for c in sorted(targets)]
        for node in rows[MAP_ROWS - 2]:
            node.next_ids = [rows[-1][0].id]

        for row in rows:
            for node in row:
                node.objective_hint = _HINTS.get(node.type, "")
        return [n for row in rows for n in row]

    def _roll_type(self, row: int) -> NodeType:
        pool = _ROW_POOLS.get(row, _ROW_POOLS[2])
        roll = self.rng.random()
        acc = 0.0
        for node_type, weight in pool:
            acc += weight
            if roll <= acc:
                return node_type
        return pool[-1][0]


_HINTS = {
    NodeType.START: "Landing zone",
    NodeType.COMBAT: "Hostile contact — lane battle",
    NodeType.ELITE: "Elite commanders — high threat, rich spoils",
    NodeType.REST: "Field camp — repair heroes, regroup troops",
    NodeType.CACHE: "Supply cache — credits & crystals",
    NodeType.ARCHIVE: "Derelict warp archive — hero blueprints & print materials",
    NodeType.BOSS: "Apex threat — eliminate the boss",
}
