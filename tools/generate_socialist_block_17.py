"""Generate an editable 17-storey socialist-era apartment block in Blender.

Run:
    blender --background --python tools/generate_socialist_block_17.py

The model includes properly mitered eight-node perimeter corners, real window
openings with frames/glazing, a ground-floor entrance opening, repeated flights
of stairs, floor-slab stairwell cut-outs, and a roof hatch with a fixed ladder.
"""
import bpy
import math
import os
from mathutils import Vector

COLLECTION_NAME = "DFLAT | Socialist apartment block | 17 floors"
FLOOR_COUNT = 17
FLOOR_TO_FLOOR = 2.8
WALL_THICKNESS = 0.20
PARTITION_THICKNESS = 0.18
SLAB_THICKNESS = 0.20

WINDOW_WIDTH = 1.30
WINDOW_SILL = 1.00
WINDOW_HEAD = 2.18
WINDOW_FRAME_WIDTH = 0.055

DOOR_WIDTH = 1.80
DOOR_HEIGHT = 2.25
DOOR_TOP = SLAB_THICKNESS + DOOR_HEIGHT

STAIR_FLIGHTS_PER_STOREY = 2
STEPS_PER_FLIGHT = 8
STAIR_TREAD = 0.28
STAIR_WIDTH = 1.00
STAIR_X_LEFT = 2.15
STAIR_X_RIGHT = 3.35
STAIR_START_Y = -2.15
STAIR_MIDDLE_Y = 0.88
STAIR_LANDING_DEPTH = 0.96
STAIR_LANDING_THICKNESS = 0.12

# The large floor openings admit the switch-back flights. The smaller roof hatch
# is positioned beside the top landing so the fixed ladder clears the stair runs.
STAIRWELL_CENTER = (3.70, -0.375)
STAIRWELL_SIZE = (3.98, 3.93)
ROOF_HATCH_CENTER = (4.95, 0.75)
ROOF_HATCH_SIZE = (1.05, 1.05)
LADDER_WIDTH = 0.62
LADDER_RAIL_DEPTH = 0.055
LADDER_RUNG_DEPTH = 0.045

# Eight ordered plan nodes. Adjacent facade strips share the exact same miter
# endpoints, avoiding gaps or overlapping square-ended walls at chamfer corners.
wall_nodes = [
    (-7.2, -6.0),
    (7.2, -6.0),
    (8.0, -5.2),
    (8.0, 5.2),
    (7.2, 6.0),
    (-7.2, 6.0),
    (-8.0, 5.2),
    (-8.0, -5.2),
]


def _cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def _mul(v, scalar):
    return (v[0] * scalar, v[1] * scalar)


def _normalize(v):
    length = math.hypot(v[0], v[1])
    if length < 1e-9:
        raise ValueError("Geometry contains two identical neighbouring points.")
    return (v[0] / length, v[1] / length)


def _lerp2(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def _offset_polygon(points, distance):
    """Offset a convex polygon using line intersections at each corner."""
    area = sum(
        points[i][0] * points[(i + 1) % len(points)][1]
        - points[(i + 1) % len(points)][0] * points[i][1]
        for i in range(len(points))
    )
    orientation = 1.0 if area > 0 else -1.0
    result = []
    count = len(points)

    for i, current in enumerate(points):
        previous = points[(i - 1) % count]
        following = points[(i + 1) % count]
        direction_before = _normalize(_sub(current, previous))
        direction_after = _normalize(_sub(following, current))
        normal_before = (
            orientation * direction_before[1],
            -orientation * direction_before[0],
        )
        normal_after = (
            orientation * direction_after[1],
            -orientation * direction_after[0],
        )
        line_a = _add(current, _mul(normal_before, distance))
        line_b = _add(current, _mul(normal_after, distance))
        denominator = _cross(direction_before, direction_after)

        if abs(denominator) < 1e-9:
            result.append(line_a)
            continue

        t = _cross(_sub(line_b, line_a), direction_after) / denominator
        result.append(_add(line_a, _mul(direction_before, t)))

    return result


def _append_vertical_prism(vertices, faces, quad, z0, z1):
    """Append a closed prism whose cross-section is a four-point XY quad."""
    base = len(vertices)
    vertices.extend((x, y, z0) for x, y in quad)
    vertices.extend((x, y, z1) for x, y in quad)
    faces.extend([
        (base + 3, base + 2, base + 1, base + 0),  # Bottom
        (base + 4, base + 5, base + 6, base + 7),  # Top
        (base + 0, base + 1, base + 5, base + 4),
        (base + 1, base + 2, base + 6, base + 5),
        (base + 2, base + 3, base + 7, base + 6),
        (base + 3, base + 0, base + 4, base + 7),
    ])


def _append_axis_box(vertices, faces, center, dimensions):
    """Append a closed axis-aligned box to a shared mesh."""
    cx, cy, cz = center
    sx, sy, sz = dimensions
    quad = [
        (cx - sx * 0.5, cy - sy * 0.5),
        (cx + sx * 0.5, cy - sy * 0.5),
        (cx + sx * 0.5, cy + sy * 0.5),
        (cx - sx * 0.5, cy + sy * 0.5),
    ]
    _append_vertical_prism(vertices, faces, quad, cz - sz * 0.5, cz + sz * 0.5)


def _append_prism(vertices, faces, p0, p1, thickness, z0, z1, end_extension=None):
    """Append a closed, wall-thickness prism following a plan segment."""
    direction = _normalize(_sub(p1, p0))
    half = thickness * 0.5
    extension = half if end_extension is None else end_extension
    start = _sub(p0, _mul(direction, extension))
    end = _add(p1, _mul(direction, extension))
    normal = (-direction[1], direction[0])
    offset = _mul(normal, half)
    quad = (
        _sub(start, offset),
        _sub(end, offset),
        _add(end, offset),
        _add(start, offset),
    )
    _append_vertical_prism(vertices, faces, quad, z0, z1)


def _append_facade_cell(vertices, faces, outer0, outer1, inner0, inner1, t0, t1, z0, z1):
    """Create one solid wall cell bounded by shared mitered facade edges."""
    quad = (
        _lerp2(outer0, outer1, t0),
        _lerp2(outer0, outer1, t1),
        _lerp2(inner0, inner1, t1),
        _lerp2(inner0, inner1, t0),
    )
    _append_vertical_prism(vertices, faces, quad, z0, z1)


def _append_centered_facade_prism(
    vertices, faces, outer0, outer1, inner0, inner1, t0, t1, z0, z1, depth
):
    """Add a thin frame or pane centred through the facade-wall thickness."""
    outer_a = _lerp2(outer0, outer1, t0)
    outer_b = _lerp2(outer0, outer1, t1)
    inner_a = _lerp2(inner0, inner1, t0)
    inner_b = _lerp2(inner0, inner1, t1)
    normal_a = _normalize(_sub(inner_a, outer_a))
    normal_b = _normalize(_sub(inner_b, outer_b))
    center_a = _mul(_add(outer_a, inner_a), 0.5)
    center_b = _mul(_add(outer_b, inner_b), 0.5)
    half_depth = depth * 0.5
    quad = (
        _sub(center_a, _mul(normal_a, half_depth)),
        _sub(center_b, _mul(normal_b, half_depth)),
        _add(center_b, _mul(normal_b, half_depth)),
        _add(center_a, _mul(normal_a, half_depth)),
    )
    _append_vertical_prism(vertices, faces, quad, z0, z1)


def _window_intervals(edge_index, length):
    """Return normalised window ranges for long facades; chamfers stay solid."""
    if length < 8.0:
        return []

    if edge_index == 0:
        # Four windows on the entrance facade leave a wide, clear doorway bay.
        centers = (0.12, 0.34, 0.66, 0.88)
    elif length > 12.0:
        centers = (0.10, 0.30, 0.50, 0.70, 0.90)
    else:
        centers = (0.20, 0.50, 0.80)

    half_t = WINDOW_WIDTH / (2.0 * length)
    return [(center - half_t, center + half_t) for center in centers]


def _build_facade_segment(vertices, faces, edge_index, outer, inner, include_entry):
    """Build one facade with true through-openings, including the entrance."""
    next_index = (edge_index + 1) % len(wall_nodes)
    outer0, outer1 = outer[edge_index], outer[next_index]
    inner0, inner1 = inner[edge_index], inner[next_index]
    length = math.dist(wall_nodes[edge_index], wall_nodes[next_index])
    windows = _window_intervals(edge_index, length)
    openings = [
        (t0, t1, WINDOW_SILL, WINDOW_HEAD)
        for t0, t1 in windows
    ]

    if include_entry and edge_index == 0:
        half_door_t = DOOR_WIDTH / (2.0 * length)
        openings.append((0.5 - half_door_t, 0.5 + half_door_t, SLAB_THICKNESS, DOOR_TOP))

    if not openings:
        _append_facade_cell(
            vertices, faces, outer0, outer1, inner0, inner1,
            0.0, 1.0, SLAB_THICKNESS, FLOOR_TO_FLOOR,
        )
        return

    t_breaks = [0.0, 1.0]
    z_breaks = [SLAB_THICKNESS, FLOOR_TO_FLOOR]
    for t0, t1, z0, z1 in openings:
        t_breaks.extend((t0, t1))
        z_breaks.extend((z0, z1))
    t_breaks = sorted(set(round(value, 10) for value in t_breaks))
    z_breaks = sorted(set(round(value, 10) for value in z_breaks))

    for ti in range(len(t_breaks) - 1):
        t0, t1 = t_breaks[ti], t_breaks[ti + 1]
        if t1 - t0 < 1e-8:
            continue
        t_mid = (t0 + t1) * 0.5

        for zi in range(len(z_breaks) - 1):
            z0, z1 = z_breaks[zi], z_breaks[zi + 1]
            if z1 - z0 < 1e-8:
                continue
            z_mid = (z0 + z1) * 0.5
            inside_opening = any(
                open_t0 < t_mid < open_t1 and open_z0 < z_mid < open_z1
                for open_t0, open_t1, open_z0, open_z1 in openings
            )
            if inside_opening:
                continue

            _append_facade_cell(
                vertices, faces, outer0, outer1, inner0, inner1,
                t0, t1, z0, z1,
            )


def _build_wall_mesh(include_entry=False):
    if len(wall_nodes) != 8:
        raise ValueError("The perimeter must be defined by exactly eight nodes.")

    outer = _offset_polygon(wall_nodes, WALL_THICKNESS * 0.5)
    inner = _offset_polygon(wall_nodes, -WALL_THICKNESS * 0.5)
    wall_vertices = []
    wall_faces = []

    for edge_index in range(len(wall_nodes)):
        _build_facade_segment(
            wall_vertices, wall_faces, edge_index, outer, inner, include_entry
        )

    # Interior walls share the same mesh and floor pitch as the outer shell.
    # Gaps in the partitions form doorways to the hallway and stairwell.
    partition_face_start = len(wall_faces)
    partitions = [
        # Hallway sides with doorway gaps.
        ((-1.0, -6.0), (-1.0, -4.0)),
        ((-1.0, -2.8), (-1.0, -1.2)),
        ((-1.0, -0.1), (-1.0, 1.8)),
        ((-1.0, 3.0), (-1.0, 6.0)),
        ((1.0, -6.0), (1.0, -4.0)),
        ((1.0, -2.8), (1.0, -0.55)),
        ((1.0, 0.55), (1.0, 1.8)),
        ((1.0, 3.0), (1.0, 6.0)),
        # Room separator to the west of the hall.
        ((-8.0, 0.15), (-1.0, 0.15)),
        # Stair core west wall has a clear doorway at y=0.25..1.25.
        ((1.8, -2.25), (1.8, 0.25)),
        ((1.8, 1.25), (1.8, 1.5)),
        # Stair core east wall and the room separator are joined.
        ((5.6, -2.25), (5.6, 1.5)),
        ((1.0, 0.15), (1.8, 0.15)),
        ((5.6, 0.15), (8.0, 0.15)),
    ]

    for start, end in partitions:
        _append_prism(
            wall_vertices, wall_faces, start, end,
            PARTITION_THICKNESS, SLAB_THICKNESS, FLOOR_TO_FLOOR,
        )

    return wall_vertices, wall_faces, partition_face_start


def _build_window_accessories(outer, inner):
    frame_vertices, frame_faces = [], []
    glass_vertices, glass_faces = [], []

    for edge_index in range(len(wall_nodes)):
        next_index = (edge_index + 1) % len(wall_nodes)
        outer0, outer1 = outer[edge_index], outer[next_index]
        inner0, inner1 = inner[edge_index], inner[next_index]
        length = math.dist(wall_nodes[edge_index], wall_nodes[next_index])
        if length < 1e-8:
            continue

        for t0, t1 in _window_intervals(edge_index, length):
            frame_t = WINDOW_FRAME_WIDTH / length
            pane_inset_t = 0.10 / length
            # Metal frame: two jambs and sill/header bars, inset inside the cutout.
            for a0, a1 in (
                (t0, min(t0 + frame_t, t1)),
                (max(t1 - frame_t, t0), t1),
            ):
                _append_centered_facade_prism(
                    frame_vertices, frame_faces, outer0, outer1, inner0, inner1,
                    a0, a1, WINDOW_SILL, WINDOW_HEAD, 0.07,
                )
            _append_centered_facade_prism(
                frame_vertices, frame_faces, outer0, outer1, inner0, inner1,
                t0, t1, WINDOW_SILL, WINDOW_SILL + WINDOW_FRAME_WIDTH, 0.07,
            )
            _append_centered_facade_prism(
                frame_vertices, frame_faces, outer0, outer1, inner0, inner1,
                t0, t1, WINDOW_HEAD - WINDOW_FRAME_WIDTH, WINDOW_HEAD, 0.07,
            )
            # A smaller inset pane leaves the surrounding wall opening visible.
            _append_centered_facade_prism(
                glass_vertices, glass_faces, outer0, outer1, inner0, inner1,
                t0 + pane_inset_t, t1 - pane_inset_t,
                WINDOW_SILL + 0.10, WINDOW_HEAD - 0.10, 0.025,
            )

    return frame_vertices, frame_faces, glass_vertices, glass_faces


def _build_slab_mesh():
    # v_slab contains eight bottom and eight top vertices of the 200 mm panel.
    outline = _offset_polygon(wall_nodes, WALL_THICKNESS * 0.5)
    count = len(outline)
    v_slab = [(x, y, 0.0) for x, y in outline]
    v_slab.extend((x, y, SLAB_THICKNESS) for x, y in outline)
    slab_faces = [
        tuple(reversed(range(count))),  # Bottom
        tuple(count + i for i in range(count)),  # Top
    ]
    for i in range(count):
        j = (i + 1) % count
        slab_faces.append((i, j, count + j, count + i))
    return v_slab, slab_faces


def _apply_boolean_cut(obj, name, center, dimensions, collection):
    """Apply a precise Boolean cut to a simple base mesh before its Array."""
    cutter_vertices, cutter_faces = [], []
    _append_axis_box(cutter_vertices, cutter_faces, center, dimensions)
    cutter = _make_mesh_object(
        name + " | temporary cutter",
        cutter_vertices, cutter_faces, collection, None,
    )

    boolean = obj.modifiers.new(name=name, type="BOOLEAN")
    boolean.operation = "DIFFERENCE"
    boolean.solver = "EXACT"
    boolean.object = cutter

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=boolean.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def _make_mesh_object(name, vertices, faces, collection, material):
    mesh = bpy.data.meshes.new(name + " | mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=True)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    return obj


def _make_material(name, colour, roughness=0.88, metallic=0.0):
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name)
    rgba = (colour[0], colour[1], colour[2], 1.0)
    material.diffuse_color = rgba
    material.roughness = roughness
    material.metallic = metallic

    # Match viewport colours with a real Principled shader so background renders
    # don't silently fall back to Blender's default white material.
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = rgba
        principled.inputs["Roughness"].default_value = roughness
        principled.inputs["Metallic"].default_value = metallic
    return material


def _add_array(obj, name, count):
    modifier = obj.modifiers.new(name=name, type="ARRAY")
    modifier.count = count
    modifier.use_relative_offset = False
    modifier.use_constant_offset = True
    modifier.constant_offset_displace = (0.0, 0.0, FLOOR_TO_FLOOR)
    modifier.use_merge_vertices = False
    return modifier


def _assign_partition_material(obj, partition_face_start):
    for polygon in obj.data.polygons:
        if polygon.index >= partition_face_start:
            polygon.material_index = 1


def _append_oriented_stair_rail(vertices, faces, x_center, y0, z0, y1, z1, width, depth):
    """Append a rectangular beam following a sloped Y/Z line."""
    dy, dz = y1 - y0, z1 - z0
    length = math.hypot(dy, dz)
    if length < 1e-8:
        return
    perpendicular_y, perpendicular_z = -dz / length, dy / length
    base = len(vertices)

    for y, z in ((y0, z0), (y1, z1)):
        for sign_x, sign_p in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            vertices.append((
                x_center + sign_x * width * 0.5,
                y + sign_p * perpendicular_y * depth * 0.5,
                z + sign_p * perpendicular_z * depth * 0.5,
            ))

    faces.extend([
        (base + 3, base + 2, base + 1, base + 0),
        (base + 4, base + 5, base + 6, base + 7),
        (base + 0, base + 1, base + 5, base + 4),
        (base + 1, base + 2, base + 6, base + 5),
        (base + 2, base + 3, base + 7, base + 6),
        (base + 3, base + 0, base + 4, base + 7),
    ])


def _append_stair_flight(vertices, faces, rail_vertices, rail_faces,
                         x_start, bottom_z, y_start, direction, top_z):
    rise = (top_z - bottom_z) / STEPS_PER_FLIGHT
    landing_y = y_start + direction * STEPS_PER_FLIGHT * STAIR_TREAD

    for step in range(STEPS_PER_FLIGHT):
        tread_center_y = y_start + direction * (step + 0.5) * STAIR_TREAD
        step_top = bottom_z + (step + 1) * rise
        step_base = bottom_z
        if direction < 0:
            step_base = bottom_z
        _append_axis_box(
            vertices, faces,
            (x_start + STAIR_WIDTH * 0.5, tread_center_y,
             (step_base + step_top) * 0.5),
            (STAIR_WIDTH, STAIR_TREAD + 0.015, step_top - step_base),
        )

    # Metal handrails on both sides of the flight.
    rail_z0 = bottom_z + 0.88
    rail_z1 = top_z + 0.82
    for x_center in (x_start + 0.035, x_start + STAIR_WIDTH - 0.035):
        _append_oriented_stair_rail(
            rail_vertices, rail_faces, x_center,
            y_start - direction * 0.10, rail_z0,
            landing_y - direction * 0.02, rail_z1,
            0.045, 0.045,
        )

        # Five simple balusters per rail keep the stair readable at a distance.
        for post_index in range(5):
            fraction = post_index / 4.0
            y = y_start + direction * (0.16 + fraction * (STEPS_PER_FLIGHT - 1) * STAIR_TREAD)
            step_z = bottom_z + (fraction * (top_z - bottom_z))
            rail_z = rail_z0 + fraction * (rail_z1 - rail_z0)
            _append_axis_box(
                rail_vertices, rail_faces,
                (x_center, y, (step_z + 0.16 + rail_z) * 0.5),
                (0.045, 0.045, max(0.12, rail_z - step_z - 0.16)),
            )


def _build_stair_mesh():
    stair_vertices, stair_faces = [], []
    rail_vertices, rail_faces = [], []
    bottom_z = SLAB_THICKNESS
    middle_z = bottom_z + FLOOR_TO_FLOOR * 0.5
    upper_z = bottom_z + FLOOR_TO_FLOOR

    # Ground-level landing; each repeated staircase begins at the next floor.
    _append_axis_box(
        stair_vertices, stair_faces,
        (STAIR_X_LEFT + 1.60, -1.82, bottom_z - STAIR_LANDING_THICKNESS * 0.5),
        (3.20, STAIR_LANDING_DEPTH, STAIR_LANDING_THICKNESS),
    )

    _append_stair_flight(
        stair_vertices, stair_faces, rail_vertices, rail_faces,
        STAIR_X_LEFT, bottom_z, STAIR_START_Y, 1.0, middle_z,
    )
    # Half-landing at the 1.4 m midpoint.
    _append_axis_box(
        stair_vertices, stair_faces,
        (STAIR_X_LEFT + 1.60, 0.55, middle_z - STAIR_LANDING_THICKNESS * 0.5),
        (3.20, STAIR_LANDING_DEPTH, STAIR_LANDING_THICKNESS),
    )
    _append_stair_flight(
        stair_vertices, stair_faces, rail_vertices, rail_faces,
        STAIR_X_RIGHT, middle_z, STAIR_MIDDLE_Y, -1.0, upper_z,
    )

    rail_face_start = len(stair_faces)
    rail_vertex_offset = len(stair_vertices)
    stair_vertices.extend(rail_vertices)
    stair_faces.extend(
        tuple(index + rail_vertex_offset for index in face)
        for face in rail_faces
    )
    return stair_vertices, stair_faces, rail_face_start


def _build_entrance_details(collection, concrete, door_material, glass, metal):
    frame_vertices, frame_faces = [], []
    door_vertices, door_faces = [], []
    door_glass_vertices, door_glass_faces = [], []
    handle_vertices, handle_faces = [], []

    door_center_z = SLAB_THICKNESS + DOOR_HEIGHT * 0.5
    jamb_x = DOOR_WIDTH * 0.5 - 0.04
    for x in (-jamb_x, jamb_x):
        _append_axis_box(
            frame_vertices, frame_faces,
            (x, -6.0, door_center_z),
            (0.08, 0.16, DOOR_HEIGHT),
        )
    _append_axis_box(
        frame_vertices, frame_faces,
        (0.0, -6.0, DOOR_TOP - 0.02),
        (DOOR_WIDTH, 0.16, 0.08),
    )

    # Small concrete canopy and two brackets above the entrance.
    _append_axis_box(
        frame_vertices, frame_faces,
        (0.0, -6.42, 2.58), (2.50, 0.75, 0.12),
    )
    for x in (-1.02, 1.02):
        _append_axis_box(
            frame_vertices, frame_faces,
            (x, -6.32, 2.25), (0.07, 0.10, 0.54),
        )

    # Three shallow approach steps, rising from grade to the entrance threshold.
    _append_axis_box(
        frame_vertices, frame_faces,
        (0.0, -6.285, 0.10), (2.20, 0.34, 0.20),
    )
    _append_axis_box(
        frame_vertices, frame_faces,
        (0.0, -6.625, 0.05), (2.20, 0.34, 0.10),
    )
    _append_axis_box(
        frame_vertices, frame_faces,
        (0.0, -6.965, 0.025), (2.20, 0.34, 0.05),
    )

    # Closed door leaf sits inside the real wall opening.
    _append_axis_box(
        door_vertices, door_faces,
        (0.0, -6.0, SLAB_THICKNESS + 1.06),
        (1.62, 0.055, 2.12),
    )
    _append_axis_box(
        door_glass_vertices, door_glass_faces,
        (0.0, -6.034, SLAB_THICKNESS + 1.10),
        (0.68, 0.016, 1.20),
    )
    _append_axis_box(
        handle_vertices, handle_faces,
        (0.66, -6.043, SLAB_THICKNESS + 1.03),
        (0.035, 0.025, 0.12),
    )

    _make_mesh_object(
        "03 | Entrance surround, canopy and approach steps",
        frame_vertices, frame_faces, collection, concrete,
    )
    _make_mesh_object(
        "04 | Ground-floor entrance door",
        door_vertices, door_faces, collection, door_material,
    )
    _make_mesh_object(
        "05 | Entrance door glass",
        door_glass_vertices, door_glass_faces, collection, glass,
    )
    _make_mesh_object(
        "06 | Door handle",
        handle_vertices, handle_faces, collection, metal,
    )


def _build_roof_ladder(collection, metal):
    vertices, faces = [], []
    top_floor_z = SLAB_THICKNESS + (FLOOR_COUNT - 1) * FLOOR_TO_FLOOR
    roof_top_z = FLOOR_COUNT * FLOOR_TO_FLOOR + SLAB_THICKNESS
    ladder_x, ladder_y = ROOF_HATCH_CENTER
    rail_offset = LADDER_WIDTH * 0.5 - LADDER_RAIL_DEPTH * 0.5

    # Side rails reach above the roof so the ladder can be climbed out safely.
    for x in (ladder_x - rail_offset, ladder_x + rail_offset):
        _append_axis_box(
            vertices, faces,
            (x, ladder_y, (top_floor_z + roof_top_z + 0.38) * 0.5),
            (LADDER_RAIL_DEPTH, LADDER_RAIL_DEPTH,
             roof_top_z - top_floor_z + 0.38),
        )

    rung_count = int((roof_top_z - top_floor_z - 0.24) / 0.28) + 1
    for rung_index in range(rung_count):
        z = top_floor_z + 0.14 + rung_index * 0.28
        if z > roof_top_z - 0.06:
            continue
        _append_axis_box(
            vertices, faces,
            (ladder_x, ladder_y, z),
            (LADDER_WIDTH - 0.08, LADDER_RUNG_DEPTH, LADDER_RUNG_DEPTH),
        )

    # Raised metal border marks the hatch opening on the roof surface.
    hatch_x, hatch_y = ROOF_HATCH_CENTER
    hatch_w, hatch_d = ROOF_HATCH_SIZE
    z_frame = roof_top_z + 0.035
    frame_thickness = 0.055
    _append_axis_box(
        vertices, faces,
        (hatch_x, hatch_y - hatch_d * 0.5, z_frame),
        (hatch_w + frame_thickness, frame_thickness, 0.07),
    )
    _append_axis_box(
        vertices, faces,
        (hatch_x, hatch_y + hatch_d * 0.5, z_frame),
        (hatch_w + frame_thickness, frame_thickness, 0.07),
    )
    _append_axis_box(
        vertices, faces,
        (hatch_x - hatch_w * 0.5, hatch_y, z_frame),
        (frame_thickness, hatch_d, 0.07),
    )
    _append_axis_box(
        vertices, faces,
        (hatch_x + hatch_w * 0.5, hatch_y, z_frame),
        (frame_thickness, hatch_d, 0.07),
    )

    _make_mesh_object(
        "09 | Fixed ladder from top floor to roof hatch",
        vertices, faces, collection, metal,
    )


def _build_exterior_finish(collection, concrete, facade_detail, metal):
    """Add facade belt courses, panel joints, rainwater pipes and a finished roof."""
    roof_top_z = FLOOR_COUNT * FLOOR_TO_FLOOR + SLAB_THICKNESS

    # Thin horizontal belt courses make the 2.8 m panel rhythm readable in silhouette.
    band_path = _offset_polygon(wall_nodes, WALL_THICKNESS * 0.5 + 0.035)
    band_vertices, band_faces = [], []
    for index, start in enumerate(band_path):
        end = band_path[(index + 1) % len(band_path)]
        _append_prism(
            band_vertices, band_faces, start, end, 0.055,
            FLOOR_TO_FLOOR - 0.13, FLOOR_TO_FLOOR - 0.065,
            end_extension=0.012,
        )
    bands = _make_mesh_object(
        "14 | Repeated horizontal facade belt courses",
        band_vertices, band_faces, collection, facade_detail,
    )
    _add_array(bands, "Belt course | 17 storeys", FLOOR_COUNT)

    # Subtle vertical panel joints sit in the bays between windows, never across
    # the ground-floor entrance or glazing. Their Array shares the storey pitch.
    outer = _offset_polygon(wall_nodes, WALL_THICKNESS * 0.5)
    inner = _offset_polygon(wall_nodes, -WALL_THICKNESS * 0.5)
    joint_vertices, joint_faces = [], []
    for edge_index, start in enumerate(wall_nodes):
        next_index = (edge_index + 1) % len(wall_nodes)
        length = math.dist(start, wall_nodes[next_index])
        windows = _window_intervals(edge_index, length)
        for window_index in range(len(windows) - 1):
            seam_t = (windows[window_index][1] + windows[window_index + 1][0]) * 0.5
            if edge_index == 0 and abs(seam_t - 0.5) < 0.05:
                continue
            seam_half_t = 0.010 / length
            _append_centered_facade_prism(
                joint_vertices, joint_faces,
                outer[edge_index], outer[next_index],
                inner[edge_index], inner[next_index],
                seam_t - seam_half_t, seam_t + seam_half_t,
                0.34, FLOOR_TO_FLOOR - 0.24, 0.022,
            )
    joints = _make_mesh_object(
        "15 | Fine vertical facade panel joints",
        joint_vertices, joint_faces, collection, facade_detail,
    )
    _add_array(joints, "Panel joints | 17 storeys", FLOOR_COUNT)

    # Downpipes follow the eight exterior chamfer vertices from roof to grade.
    pipe_path = _offset_polygon(wall_nodes, WALL_THICKNESS * 0.5 + 0.11)
    pipe_vertices, pipe_faces = [], []
    for x, y in pipe_path:
        _append_axis_box(
            pipe_vertices, pipe_faces,
            (x, y, roof_top_z * 0.5),
            (0.075, 0.075, roof_top_z),
        )
    _make_mesh_object(
        "16 | Eight full-height rainwater downpipes",
        pipe_vertices, pipe_faces, collection, metal,
    )

    # A continuous parapet and wider coping finish the roof perimeter.
    parapet_vertices, parapet_faces = [], []
    coping_vertices, coping_faces = [], []
    for index, start in enumerate(wall_nodes):
        end = wall_nodes[(index + 1) % len(wall_nodes)]
        _append_prism(
            parapet_vertices, parapet_faces, start, end, 0.18,
            roof_top_z, roof_top_z + 0.70,
            end_extension=0.09,
        )
        _append_prism(
            coping_vertices, coping_faces, start, end, 0.25,
            roof_top_z + 0.65, roof_top_z + 0.77,
            end_extension=0.125,
        )
    _make_mesh_object(
        "17 | Continuous roof parapet",
        parapet_vertices, parapet_faces, collection, concrete,
    )
    _make_mesh_object(
        "18 | Overhanging parapet coping",
        coping_vertices, coping_faces, collection, facade_detail,
    )

    # Three modest ventilation housings and raised exhaust necks break up the
    # otherwise empty roof, while staying well clear of the ladder hatch.
    equipment_vertices, equipment_faces = [], []
    exhaust_vertices, exhaust_faces = [], []
    for x, y, width, depth in (
        (-4.8, -2.4, 1.65, 1.30),
        (-1.3, 3.1, 1.45, 1.20),
        (1.8, -3.3, 1.55, 1.25),
    ):
        height = 0.64
        _append_axis_box(
            equipment_vertices, equipment_faces,
            (x, y, roof_top_z + height * 0.5),
            (width, depth, height),
        )
        neck_height = 0.48
        _append_axis_box(
            exhaust_vertices, exhaust_faces,
            (x, y, roof_top_z + height + neck_height * 0.5),
            (0.42, 0.42, neck_height),
        )
        _append_axis_box(
            exhaust_vertices, exhaust_faces,
            (x, y, roof_top_z + height + neck_height + 0.035),
            (0.60, 0.60, 0.07),
        )
    _make_mesh_object(
        "19 | Rooftop ventilation housings",
        equipment_vertices, equipment_faces, collection, concrete,
    )
    _make_mesh_object(
        "20 | Raised roof exhausts",
        exhaust_vertices, exhaust_faces, collection, metal,
    )


def _build_entrance_sign(collection, plaque_material, lettering_material, metal):
    """Add a small legible entrance plaque and a simple intercom."""
    plaque_vertices, plaque_faces = [], []
    intercom_vertices, intercom_faces = [], []
    _append_axis_box(
        plaque_vertices, plaque_faces,
        (0.0, -6.20, 2.32),
        (1.42, 0.075, 0.22),
    )
    _append_axis_box(
        intercom_vertices, intercom_faces,
        (-1.20, -6.16, 1.48),
        (0.16, 0.07, 0.28),
    )
    _append_axis_box(
        intercom_vertices, intercom_faces,
        (-1.20, -6.205, 1.54),
        (0.045, 0.025, 0.045),
    )
    _make_mesh_object(
        "21 | Entrance plaque",
        plaque_vertices, plaque_faces, collection, plaque_material,
    )
    _make_mesh_object(
        "22 | Entry intercom",
        intercom_vertices, intercom_faces, collection, metal,
    )

    text_curve = bpy.data.curves.new("DFLAT | Entrance lettering", type="FONT")
    text_curve.body = "VCHOD 01"
    text_curve.size = 0.115
    text_curve.extrude = 0.002
    text_obj = bpy.data.objects.new("23 | Entrance lettering", text_curve)
    collection.objects.link(text_obj)
    text_obj.location = (-0.43, -6.245, 2.275)
    text_obj.rotation_euler = (math.pi * 0.5, 0.0, 0.0)
    text_curve.materials.append(lettering_material)


def _add_area_light(collection, name, location, target, power, size, colour):
    light_data = bpy.data.lights.new(name=name, type="AREA")
    light_data.energy = power
    light_data.shape = "DISK"
    light_data.size = size
    light_data.color = colour
    light_obj = bpy.data.objects.new(name, light_data)
    collection.objects.link(light_obj)
    light_obj.location = location
    light_obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    return light_obj


def _create_scene_preview(scene, collection, ground_material, paving_material, asphalt_material):
    """Remove Blender startup clutter and prepare a useful camera/render on first open."""
    for default_name in ("Cube", "Camera", "Light"):
        default_obj = bpy.data.objects.get(default_name)
        if default_obj:
            bpy.data.objects.remove(default_obj, do_unlink=True)

    # A matte ground, a concrete arrival apron, a straight approach path, and a
    # simple street give the high-rise a clear sense of scale and street frontage.
    ground_vertices = [
        (-100.0, -100.0, -0.012),
        (100.0, -100.0, -0.012),
        (100.0, 100.0, -0.012),
        (-100.0, 100.0, -0.012),
    ]
    ground = _make_mesh_object(
        "24 | Ground plane",
        ground_vertices, [(0, 1, 2, 3)], collection, ground_material,
    )

    apron_vertices, apron_faces = [], []
    _append_axis_box(
        apron_vertices, apron_faces,
        (0.0, -8.15, 0.005), (4.8, 2.25, 0.08),
    )
    _make_mesh_object(
        "25 | Entrance forecourt",
        apron_vertices, apron_faces, collection, paving_material,
    )

    path_vertices, path_faces = [], []
    _append_axis_box(
        path_vertices, path_faces,
        (0.0, -14.70, 0.005), (3.5, 13.5, 0.08),
    )
    _make_mesh_object(
        "26 | Front approach path",
        path_vertices, path_faces, collection, paving_material,
    )

    road_vertices, road_faces = [], []
    _append_axis_box(
        road_vertices, road_faces,
        (0.0, -25.0, -0.005), (44.0, 7.0, 0.08),
    )
    _make_mesh_object(
        "27 | Street in front of the building",
        road_vertices, road_faces, collection, asphalt_material,
    )

    # Remove a stale render camera if it was linked elsewhere, then use an
    # orthographic portrait view so all seventeen storeys fit in one frame.
    camera_data = bpy.data.cameras.new("DFLAT | Architectural preview camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 48.0
    camera_data.lens = 55.0
    camera_data.clip_start = 0.1
    camera_data.clip_end = 350.0
    camera_obj = bpy.data.objects.new("28 | Architectural preview camera", camera_data)
    collection.objects.link(camera_obj)
    camera_obj.location = (78.0, -105.0, 87.0)
    target = (0.0, 0.0, FLOOR_COUNT * FLOOR_TO_FLOOR * 0.5 + 0.2)
    camera_obj.rotation_euler = (Vector(target) - camera_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera_obj

    _add_area_light(
        collection, "29 | Large warm key light",
        (-28.0, -38.0, 68.0), (0.0, 0.0, 24.0),
        18000.0, 34.0, (1.0, 0.88, 0.72),
    )
    _add_area_light(
        collection, "30 | Cool front fill",
        (32.0, -16.0, 42.0), (0.0, 0.0, 24.0),
        10500.0, 28.0, (0.68, 0.80, 1.0),
    )
    _add_area_light(
        collection, "31 | Roof rim light",
        (-12.0, 24.0, 58.0), (0.0, 0.0, 25.0),
        15000.0, 24.0, (1.0, 0.95, 0.84),
    )

    if scene.world is None:
        scene.world = bpy.data.worlds.new("DFLAT | Preview world")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.035, 0.045, 0.06, 1.0)
        background.inputs["Strength"].default_value = 0.45

    # Prefer modern Eevee, with a compatibility fallback for older Blender builds.
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except (TypeError, ValueError):
        try:
            scene.render.engine = "BLENDER_EEVEE"
        except (TypeError, ValueError):
            pass

    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.camera.data.dof.use_dof = False

    try:
        scene.view_settings.view_transform = "AgX"
    except (TypeError, ValueError):
        pass

    # Background runs can still save the UI's initial viewport as camera view.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"


def _clear_previous_build():
    old = bpy.data.collections.get(COLLECTION_NAME)
    if old is None:
        return
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old, do_unlink=True)


def build():
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    _clear_previous_build()

    collection = bpy.data.collections.new(COLLECTION_NAME)
    scene.collection.children.link(collection)

    concrete = _make_material("DFLAT | light concrete", (0.52, 0.50, 0.46))
    partition_material = _make_material("DFLAT | interior concrete", (0.61, 0.59, 0.54))
    slab_material = _make_material("DFLAT | floor slab", (0.43, 0.42, 0.39))
    frame_material = _make_material("DFLAT | window frames", (0.30, 0.32, 0.31), metallic=0.35)
    glass_material = _make_material("DFLAT | dark window glass", (0.075, 0.13, 0.15), roughness=0.28, metallic=0.18)
    stair_material = _make_material("DFLAT | stair concrete", (0.47, 0.45, 0.41))
    metal_material = _make_material("DFLAT | dark metal", (0.18, 0.20, 0.20), roughness=0.42, metallic=0.65)
    door_material = _make_material("DFLAT | entrance door", (0.16, 0.23, 0.22), roughness=0.52)
    facade_detail_material = _make_material("DFLAT | facade bands and coping", (0.39, 0.38, 0.35), roughness=0.82)
    ground_material = _make_material("DFLAT | ground", (0.20, 0.22, 0.21), roughness=0.96)
    paving_material = _make_material("DFLAT | concrete paving", (0.39, 0.38, 0.35), roughness=0.94)
    asphalt_material = _make_material("DFLAT | asphalt", (0.055, 0.062, 0.068), roughness=0.96)

    # Ground-floor shell contains the only exterior doorway. Typical floors are
    # a separate 16-copy Array, so the entrance never repeats on upper storeys.
    ground_vertices, ground_faces, ground_partition_start = _build_wall_mesh(include_entry=True)
    ground_walls = _make_mesh_object(
        "01 | Ground-floor perimeter and partitions",
        ground_vertices, ground_faces, collection, concrete,
    )
    ground_walls.data.materials.append(partition_material)
    _assign_partition_material(ground_walls, ground_partition_start)

    upper_vertices, upper_faces, upper_partition_start = _build_wall_mesh(include_entry=False)
    upper_walls = _make_mesh_object(
        "02 | Upper floors perimeter and partitions | 16 copies",
        upper_vertices, upper_faces, collection, concrete,
    )
    upper_walls.data.materials.append(partition_material)
    _assign_partition_material(upper_walls, upper_partition_start)
    upper_walls.location.z = FLOOR_TO_FLOOR
    _add_array(upper_walls, "Upper storeys | 2.8 m pitch", FLOOR_COUNT - 1)

    # Real window holes are formed in each facade mesh; separate frames/panes
    # sit inside the cutouts and are repeated across all 17 storeys.
    outer = _offset_polygon(wall_nodes, WALL_THICKNESS * 0.5)
    inner = _offset_polygon(wall_nodes, -WALL_THICKNESS * 0.5)
    frame_v, frame_f, glass_v, glass_f = _build_window_accessories(outer, inner)
    window_frames = _make_mesh_object(
        "07 | Window frames | 17 storeys", frame_v, frame_f, collection, frame_material,
    )
    window_glass = _make_mesh_object(
        "08 | Window glazing | 17 storeys", glass_v, glass_f, collection, glass_material,
    )
    _add_array(window_frames, "Window frame repeat | 17 floors", FLOOR_COUNT)
    _add_array(window_glass, "Window glass repeat | 17 floors", FLOOR_COUNT)

    # Concrete panels: one full foundation, 16 floor slabs with a stairwell
    # opening, plus a separate roof panel with only the smaller ladder hatch.
    v_slab, slab_faces = _build_slab_mesh()
    slab_mesh = bpy.data.meshes.new("v_slab | 200 mm closed panel")
    slab_mesh.from_pydata(v_slab, [], slab_faces)
    slab_mesh.validate(verbose=True)
    slab_mesh.update(calc_edges=True)
    slab_mesh.materials.append(slab_material)

    foundation = bpy.data.objects.new("00 | Foundation slab | 200 mm", slab_mesh)
    collection.objects.link(foundation)

    floor_array = bpy.data.objects.new("10 | Intermediate floor slabs | 16 panels", slab_mesh.copy())
    collection.objects.link(floor_array)
    _apply_boolean_cut(
        floor_array,
        "Stairwell shaft cut-out",
        (STAIRWELL_CENTER[0], STAIRWELL_CENTER[1], SLAB_THICKNESS * 0.5),
        (STAIRWELL_SIZE[0], STAIRWELL_SIZE[1], 1.0),
        collection,
    )
    floor_array.location.z = FLOOR_TO_FLOOR
    _add_array(floor_array, "16 floors | stairwell opening", FLOOR_COUNT - 1)

    roof = bpy.data.objects.new("11 | Roof slab with ladder hatch | 200 mm", slab_mesh.copy())
    collection.objects.link(roof)
    _apply_boolean_cut(
        roof,
        "Roof ladder hatch cut-out",
        (ROOF_HATCH_CENTER[0], ROOF_HATCH_CENTER[1], SLAB_THICKNESS * 0.5),
        (ROOF_HATCH_SIZE[0], ROOF_HATCH_SIZE[1], 1.0),
        collection,
    )
    roof.location.z = FLOOR_COUNT * FLOOR_TO_FLOOR

    stair_vertices, stair_faces, rail_face_start = _build_stair_mesh()
    stairs = _make_mesh_object(
        "12 | Switch-back stairs and handrails | 16 flights",
        stair_vertices, stair_faces, collection, stair_material,
    )
    stairs.data.materials.append(metal_material)
    for polygon in stairs.data.polygons:
        if polygon.index >= rail_face_start:
            polygon.material_index = 1
    _add_array(stairs, "Stairs between all 17 storeys | 2.8 m pitch", FLOOR_COUNT - 1)

    # Top-floor bridge links the final stair landing to the fixed roof ladder.
    top_floor_z = SLAB_THICKNESS + (FLOOR_COUNT - 1) * FLOOR_TO_FLOOR
    access_vertices, access_faces = [], []
    _append_axis_box(
        access_vertices, access_faces,
        (4.55, -0.10, top_floor_z - STAIR_LANDING_THICKNESS * 0.5),
        (1.20, 2.50, STAIR_LANDING_THICKNESS),
    )
    _make_mesh_object(
        "13 | Top-floor landing to roof ladder",
        access_vertices, access_faces, collection, stair_material,
    )

    _build_entrance_details(
        collection, concrete, door_material, glass_material, metal_material,
    )
    _build_entrance_sign(
        collection, frame_material, concrete, metal_material,
    )
    _build_roof_ladder(collection, metal_material)
    _build_exterior_finish(
        collection, concrete, facade_detail_material, metal_material,
    )
    _create_scene_preview(
        scene, collection, ground_material, paving_material, asphalt_material,
    )

    # Start with a clean camera preview rather than Blender's default cube view.
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = None

    window_count_per_floor = sum(
        len(_window_intervals(i, math.dist(wall_nodes[i], wall_nodes[(i + 1) % len(wall_nodes)])))
        for i in range(len(wall_nodes))
    )
    print("DFLAT 17-storey block generated:")
    print("  mitered perimeter nodes: %d" % len(wall_nodes))
    print("  perimeter wall thickness: %.3f m" % WALL_THICKNESS)
    print("  floor-to-floor spacing: %.3f m" % FLOOR_TO_FLOOR)
    print("  storeys: %d (ground floor + %d upper floors)" % (FLOOR_COUNT, FLOOR_COUNT - 1))
    print("  window openings per storey: %d" % window_count_per_floor)
    print("  entrance cut-out: %.2f m wide x %.2f m high" % (DOOR_WIDTH, DOOR_HEIGHT))
    print("  switch-back stair runs: %d" % (FLOOR_COUNT - 1))
    print("  stairwell floor cut-outs: %d" % (FLOOR_COUNT - 1))
    print("  roof hatch: %.2f m x %.2f m" % ROOF_HATCH_SIZE)
    print("  top of roof slab: %.3f m" % (FLOOR_COUNT * FLOOR_TO_FLOOR + SLAB_THICKNESS))
    print("  wall faces (ground): %d" % len(ground_faces))
    print("  slab vertices (v_slab): %d" % len(v_slab))
    print("  slab faces before openings: %d" % len(slab_faces))


if __name__ == "__main__":
    build()
    output_path = os.path.abspath(
        os.environ.get("DFLAT_BLOCK_OUTPUT", "DFLAT_socialist_block_17.blend")
    )
    bpy.ops.wm.save_as_mainfile(filepath=output_path)
    print("Saved Blender project: " + output_path)
