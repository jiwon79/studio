"""Fill only a reviewed solid accessory's enclosed matte hole, never its handle.

A source-checked body point selects one background component. Open boundaries,
large regions and points already in foreground do not change the matte. The
caller retains the original source RGB and the existing outer alpha boundary.
"""
from collections import deque


def enclosed_hole(alpha, width, height, seed, max_fraction=.05):
    x, y = seed
    if not 0 <= x < width or not 0 <= y < height:
        return []
    first = y * width + x
    if alpha[first] > 89:
        return []
    queue = deque([first])
    visited = {first}
    limit = max(1, int(width * height * max_fraction))
    while queue:
        pixel = queue.popleft()
        px, py = pixel % width, pixel // width
        if px == 0 or px == width-1 or py == 0 or py == height-1:
            return []
        for adjacent in (pixel-1, pixel+1, pixel-width, pixel+width):
            if adjacent not in visited and alpha[adjacent] <= 89:
                visited.add(adjacent)
                if len(visited) > limit:
                    return []
                queue.append(adjacent)
    return list(visited)
