"""Build a clean 17-storey socialist-era apartment block in Blender.

Run:
    blender --background --python tools/generate_socialist_block_17.py

The scene contains a closed octagonal perimeter shell with 200 mm walls, repeated
interior partitions, 200 mm floor/ceiling panels, and non-destructive Array
modifiers with exactly 17 storeys spaced 2.8 m apart.
"""
import bpy
import math

COLLECTION_NAME = "DFLAT | Socialist apartment block | 17 floors"
FLOOR_COUNT = 17
FLOOR_TO_FLOOR = 2.8
WALL_THICKNESS = 0.20
PARTITION_THICKNESS = 0.18
SLAB_THICKNESS = 0.20
WALL_BOTTOM = SLAB_THICKNESS
WALL_TOP = FLOOR_TO_FLOOR

# Eight ordered floor-plan nodes, in metres. The chamfered corners keep the
# outline recognisably panel-built while retaining one continuous perimeter.
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


def _mul(a, scalar):
    return (a[0] * scalar, a[1] * scalar)


def _normalize(v):
    length = math.hypot(v[0], v[1])
    if length < 1e-9:
        raise ValueError("Floor plan contains two identical neighbouring nodes.")
    return (v[0] / length, v[1] / length)


def _offset_polygon(points, distance):
    """Offset a convex polygon; positive distance moves outward."""
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
            # Collinear segments need no corner intersection.
            result.append(line_a)
            continue

        t = _cross(_sub(line_b, line_a), direction_after) / denominator
        result.append(_add(line_a, _mul(direction_before, t)))

    return result


def _append_prism(vertices, faces, p0, p1, thickness, z0, z1, end_extension=None):
    """Append one closed rectangular wall panel between two plan points."""
    direction = _normalize(_sub(p1, p0))
    half = thickness * 0.5
    extension = half if end_extension is None else end_extension
    start = _sub(p0, _mul(direction, extension))
    end = _add(p1, _mul(direction, extension))
    normal = (-direction[1], direction[0])
    offset = _mul(normal, half)
    a = _add(start, offset)
    b = _add(end, offset)
    c = _sub(end, offset)
    d = _sub(start, offset)
    points = (a, b, c, d)
    base = len(vertices)

    for x, y in points:
        vertices.append((x, y, z0))
    for x, y in points:
        vertices.append((x, y, z1))

    # Consistent winding: bottom, top, and all four side faces.
    faces.extend([
        (base + 0, base + 1, base + 2, base + 3),
        (base + 4, base + 7, base + 6, base + 5),
        (base + 0, base + 4, base + 5, base + 1),
        (base + 1, base + 5, base + 6, base + 2),
        (base + 2, base + 6, base + 7, base + 3),
        (base + 3, base + 7, base + 4, base + 0),
    ])


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


def _make_material(name, colour, roughness=0.88):
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name)
    material.diffuse_color = (colour[0], colour[1], colour[2], 1.0)
    material.roughness = roughness
    return material


def _add_array(obj, name):
    modifier = obj.modifiers.new(name=name, type="ARRAY")
    modifier.count = FLOOR_COUNT
    modifier.use_relative_offset = False
    modifier.use_constant_offset = True
    modifier.constant_offset_displace = (0.0, 0.0, FLOOR_TO_FLOOR)
    modifier.use_merge_vertices = False
    return modifier


def _build_wall_mesh():
    count = len(wall_nodes)
    if count != 8:
        raise ValueError("The perimeter must be defined by exactly eight nodes.")

    outer = _offset_polygon(wall_nodes, WALL_THICKNESS * 0.5)
    inner = _offset_polygon(wall_nodes, -WALL_THICKNESS * 0.5)

    # Four indexed rings: outer bottom, outer top, inner bottom, inner top.
    # wall_faces is fully populated for all eight perimeter segments.
    wall_vertices = []
    wall_faces = []
    wall_vertices.extend((x, y, WALL_BOTTOM) for x, y in outer)
    wall_vertices.extend((x, y, WALL_TOP) for x, y in outer)
    wall_vertices.extend((x, y, WALL_BOTTOM) for x, y in inner)
    wall_vertices.extend((x, y, WALL_TOP) for x, y in inner)

    for i in range(count):
        j = (i + 1) % count
        wall_faces.extend([
            (i, j, count + j, count + i),  # Outside face
            (2 * count + j, 2 * count + i, 3 * count + i, 3 * count + j),  # Inside
            (count + i, count + j, 3 * count + j, 3 * count + i),  # Top edge
            (j, i, 2 * count + i, 2 * count + j),  # Bottom edge
        ])

    # Internal walls form a central hall and four basic room zones. Each wall is
    # a closed prism; small end overlaps meet adjacent walls without visible gaps.
    partitions = [
        # Hallway side walls, with two consistent door openings in each side.
        ((-1.0, -6.0), (-1.0, -4.0)),
        ((-1.0, -2.8), (-1.0, 1.8)),
        ((-1.0, 3.0), (-1.0, 6.0)),
        ((1.0, -6.0), (1.0, -4.0)),
        ((1.0, -2.8), (1.0, 1.8)),
        ((1.0, 3.0), (1.0, 6.0)),
        # Room separators beside the hall.
        ((-8.0, 0.15), (-1.0, 0.15)),
        ((1.0, 0.15), (8.0, 0.15)),
    ]

    for start, end in partitions:
        _append_prism(
            wall_vertices,
            wall_faces,
            start,
            end,
            PARTITION_THICKNESS,
            WALL_BOTTOM,
            WALL_TOP,
        )

    return wall_vertices, wall_faces


def _build_slab_mesh():
    # v_slab is the complete 16-vertex panel: eight bottom and eight top nodes.
    # The slab is a closed extrusion of the real-thickness perimeter footprint.
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

    wall_vertices, wall_faces = _build_wall_mesh()
    wall_object = _make_mesh_object(
        "01 | Perimeter shell + interior partitions | 17 floors",
        wall_vertices,
        wall_faces,
        collection,
        concrete,
    )
    wall_object.data.materials.append(partition_material)
    # The first 32 faces form the outer ring; all subsequent prism faces are partitions.
    perimeter_face_count = len(wall_nodes) * 4
    for polygon in wall_object.data.polygons:
        if polygon.index >= perimeter_face_count:
            polygon.material_index = 1
    # Perimeter and partitions deliberately share a single mesh/Array, so every
    # storey uses the same exact 2.8 m vertical increment.
    _add_array(wall_object, "17 storeys | 2.8 m spacing")

    v_slab, slab_faces = _build_slab_mesh()
    slab_mesh = bpy.data.meshes.new("v_slab | 200 mm closed panel")
    slab_mesh.from_pydata(v_slab, [], slab_faces)
    slab_mesh.validate(verbose=True)
    slab_mesh.update(calc_edges=True)
    slab_mesh.materials.append(slab_material)

    # Ground/foundation panel.
    foundation = bpy.data.objects.new("00 | Foundation slab | 200 mm", slab_mesh)
    collection.objects.link(foundation)
    foundation.location.z = 0.0

    # Exactly 17 ceiling/floor panels: one above every repeated wall storey,
    # including the top roof panel. The ground slab is a separate foundation.
    ceiling_array = bpy.data.objects.new(
        "02 | Floor and roof slabs | 17 panels",
        slab_mesh.copy(),
    )
    collection.objects.link(ceiling_array)
    ceiling_array.location.z = FLOOR_TO_FLOOR
    _add_array(ceiling_array, "17 slabs | 2.8 m spacing")

    # Keep the generated geometry easy to inspect in the viewport.
    bpy.ops.object.select_all(action="DESELECT")
    wall_object.select_set(True)
    bpy.context.view_layer.objects.active = wall_object

    print("DFLAT block generated:")
    print("  perimeter nodes: %d" % len(wall_nodes))
    print("  perimeter wall thickness: %.3f m" % WALL_THICKNESS)
    print("  floor-to-floor spacing: %.3f m" % FLOOR_TO_FLOOR)
    print("  repeated storeys: %d" % FLOOR_COUNT)
    print("  nominal roof height: %.3f m" % (FLOOR_COUNT * FLOOR_TO_FLOOR + SLAB_THICKNESS))
    print("  wall faces: %d" % len(wall_faces))
    print("  slab vertices (v_slab): %d" % len(v_slab))
    print("  slab faces: %d" % len(slab_faces))


if __name__ == "__main__":
    build()
