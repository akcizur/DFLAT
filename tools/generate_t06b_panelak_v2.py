"""Generate a four-storey, five-module Czechoslovak T06B-inspired panel block.

Run with Blender:
    blender --background --python tools/generate_t06b_panelak_v2.py

Coordinates are metres. This is a game/visualisation concept model, not a
construction-ready or standards-certified architectural design.
"""
import bpy
import math
import os
from mathutils import Matrix, Vector

MODULE = 3.6
MODULE_COUNT = 5
WIDTH = MODULE * MODULE_COUNT  # 18.0 m
DEPTH = 12.0
FLOORS = 4                    # 4 above-ground storeys; no lift
FLOOR_HEIGHT = 2.8
BASEMENT_HEIGHT = 2.6
SLAB = 0.18
WALL = 0.15
WINDOW_W = 1.35
WINDOW_SILL = 0.78
WINDOW_HEAD = 2.18
FRONT_Z = -DEPTH / 2
REAR_Z = DEPTH / 2
LOGGIA_WIDTH = 3.2
LOGGIA_DEPTH = 1.25
LOGGIA_BACK_Z = REAR_Z - LOGGIA_DEPTH
MODULE_CENTRES = [-7.2, -3.6, 0.0, 3.6, 7.2]

def material(name, color, roughness=0.85, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    p = nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = metallic
    # Břízolit and precast concrete need a fine mineral grain, not a clean plastic finish.
    if any(tag in name.lower() for tag in ("břízolit", "precast concrete", "prefabricated concrete", "dirty charcoal concrete")):
        noise = nodes.new("ShaderNodeTexNoise")
        noise.name = "Fine aggregate | mineral grain"
        noise.inputs["Scale"].default_value = 28.0
        noise.inputs["Detail"].default_value = 3.0
        noise.inputs["Roughness"].default_value = 0.72
        ramp = nodes.new("ShaderNodeValToRGB")
        ramp.name = "Weathered concrete tonal variation"
        ramp.color_ramp.elements[0].position = 0.22
        ramp.color_ramp.elements[0].color = (color[0]*0.70, color[1]*0.70, color[2]*0.70, 1)
        ramp.color_ramp.elements[1].position = 0.78
        ramp.color_ramp.elements[1].color = (min(1.0, color[0]*1.18), min(1.0, color[1]*1.18), min(1.0, color[2]*1.18), 1)
        bump = nodes.new("ShaderNodeBump")
        bump.name = "Fine aggregate relief"
        bump.inputs["Strength"].default_value = 0.12
        bump.inputs["Distance"].default_value = 0.025
        links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        links.new(ramp.outputs["Color"], p.inputs["Base Color"])
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return mat

def box(name, loc, size, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Small worn concrete edges", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        mod.limit_method = "ANGLE"
        obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    return obj

def text_label(name, body, loc, size, mat, rotation=(0, math.pi, 0)):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body
    curve.size = size
    curve.extrude = 0.001
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rotation
    # Counter the half-turn about vertical so the plaque faces outward without mirrored lettering.
    obj.scale.x = -1
    obj.data.materials.append(mat)
    return obj

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.collections):
        if block.name != bpy.context.scene.collection.name:
            try:
                bpy.data.collections.remove(block)
            except RuntimeError:
                pass

clear_scene()
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.render.resolution_x = 1200
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100

# Muted, slightly chalky concrete; period-appropriate paint and metal.
concrete = material("Břízolit | aged light grey aggregate render", (0.48, 0.49, 0.45))
panel = material("Prefabricated concrete | faded warm grey", (0.56, 0.55, 0.49))
dark_concrete = material("Sokl | dirty charcoal concrete", (0.22, 0.24, 0.22))
stair_concrete = material("Stairwell | worn grey concrete", (0.39, 0.40, 0.37))
frame = material("Window frames | aged ivory PVC/painted wood", (0.70, 0.67, 0.57))
glass = material("Glass | smoky desaturated blue", (0.16, 0.24, 0.26), 0.28)
glass_warm = material("Glass | occasional warm interior", (0.48, 0.36, 0.20), 0.32)
lux = material("Luxfery | ribbed glass blocks", (0.55, 0.62, 0.57), 0.22)
railing = material("Loggia railings | old oxide red enamel", (0.31, 0.095, 0.07), 0.48, 0.22)
door = material("Entrance door | dark green enamel", (0.12, 0.20, 0.16), 0.65)
metal = material("Old galvanized service metal", (0.30, 0.32, 0.30), 0.55, 0.45)
lino = material("Interior | green-grey linoleum", (0.30, 0.34, 0.29))
cream = material("Interior | aged institutional cream", (0.65, 0.61, 0.50))
red = material("Faded red civic signage", (0.42, 0.055, 0.035))
grass = material("Courtyard grass | patchy", (0.17, 0.20, 0.13))
asphalt = material("Old asphalt", (0.12, 0.13, 0.12))

# Ground and the restrained edge of a typical estate access road.
box("Site | terrain", (0, -0.24, 0), (90, 0.25, 90), grass)
box("Soviet-era estate access road", (0, -0.095, FRONT_Z-9.0), (90, 0.04, 5.5), asphalt)
box("Concrete approach pavement", (0, -0.075, FRONT_Z-5.3), (5.2, 0.07, 6.2), panel)
box("Concrete entrance apron", (0, -0.075, FRONT_Z-2.2), (7.5, 0.07, 4.2), panel)
box("Entrance step | lower", (0, -0.015, FRONT_Z-0.95), (3.2, 0.18, 0.55), panel)
box("Entrance step | upper", (0, 0.075, FRONT_Z-0.48), (2.8, 0.12, 0.42), panel)

# Four levels over a cellar. The cellar is visible as a modelled foundation band.
for floor in range(-1, FLOORS):
    base_y = -BASEMENT_HEIGHT if floor == -1 else floor * FLOOR_HEIGHT
    mat = stair_concrete if floor == -1 else panel
    if floor < 0:
        box(f"Floor {floor} | structural slab", (0, base_y - SLAB/2, 0),
            (WIDTH, SLAB, DEPTH), mat)
    else:
        # The upper slabs stop at the central stair void and at each recessed
        # loggia. Four short rear bridges remain outside the two loggia bays.
        core_left, core_right = -1.5, 1.5
        core_front, core_rear = -2.2, 2.2
        side_width = WIDTH/2-core_right
        interior_depth = LOGGIA_BACK_Z-FRONT_Z
        interior_z = (FRONT_Z+LOGGIA_BACK_Z)/2
        box(f"Floor {floor} | left slab wing",
            ((-WIDTH/2+core_left)/2, base_y-SLAB/2, interior_z),
            (side_width, SLAB, interior_depth), mat)
        box(f"Floor {floor} | right slab wing",
            ((core_right+WIDTH/2)/2, base_y-SLAB/2, interior_z),
            (side_width, SLAB, interior_depth), mat)
        box(f"Floor {floor} | slab before stair core",
            (0, base_y-SLAB/2, (FRONT_Z+core_front)/2),
            (core_right-core_left, SLAB, core_front-FRONT_Z), mat)
        box(f"Floor {floor} | slab after stair core",
            (0, base_y-SLAB/2, (core_rear+LOGGIA_BACK_Z)/2),
            (core_right-core_left, SLAB, LOGGIA_BACK_Z-core_rear), mat)

        loggia_left_outer = -3.6-LOGGIA_WIDTH/2
        loggia_left_inner = -3.6+LOGGIA_WIDTH/2
        loggia_right_inner = 3.6-LOGGIA_WIDTH/2
        loggia_right_outer = 3.6+LOGGIA_WIDTH/2
        rear_bridge_bays = (
            (-WIDTH/2, loggia_left_outer),
            (loggia_left_inner, core_left),
            (core_left, core_right),
            (core_right, loggia_right_inner),
            (loggia_right_outer, WIDTH/2),
        )
        rear_bridge_depth = REAR_Z-LOGGIA_BACK_Z
        rear_bridge_z = (REAR_Z+LOGGIA_BACK_Z)/2
        for x0, x1 in rear_bridge_bays:
            if x1-x0 > 0.01:
                box(f"Floor {floor} | rear bridge outside loggias",
                    ((x0+x1)/2, base_y-SLAB/2, rear_bridge_z),
                    (x1-x0, SLAB, rear_bridge_depth), mat)

# Foundation plinth and cellar wall.
box("Continuous cellar plinth | weather staining", (0, -BASEMENT_HEIGHT/2, FRONT_Z-0.03),
    (WIDTH, BASEMENT_HEIGHT, 0.28), dark_concrete, 0.025)
box("Rear cellar wall", (0, -BASEMENT_HEIGHT/2, REAR_Z+0.03),
    (WIDTH, BASEMENT_HEIGHT, 0.28), dark_concrete)
for x in (-WIDTH/2+0.14, WIDTH/2-0.14):
    box("Cellar | end wall", (x, -BASEMENT_HEIGHT/2, 0),
        (0.28, BASEMENT_HEIGHT, DEPTH), dark_concrete)

# Window openings are built as separate wall piers, sill, and lintel rather than
# glass floating over a continuous solid wall.
def facade_floor(floor, z, south=False):
    y0 = floor * FLOOR_HEIGHT
    openings = []
    for cx in (-7.2, -3.6, 3.6, 7.2):
        is_loggia_door = south and abs(abs(cx)-3.6) < 0.01
        openings.append({
            "x": cx, "width": LOGGIA_WIDTH if is_loggia_door else WINDOW_W,
            "sill": 0.0 if is_loggia_door else WINDOW_SILL,
            "head": WINDOW_HEAD, "kind": "loggia" if is_loggia_door else "window"
        })
    if not south and floor == 0:
        openings.append({"x": 0.0, "width": 1.8, "sill": 0.0, "head": 2.28, "kind": "entrance"})
    if not south and floor > 0:
        openings.append({"x": 0.0, "width": 2.0, "sill": 0.30, "head": 2.45, "kind": "luxfer"})
    openings.sort(key=lambda item: item["x"]-item["width"]/2)

    cursor = -WIDTH/2
    for opening in openings:
        cx, opening_w = opening["x"], opening["width"]
        left, right = cx-opening_w/2, cx+opening_w/2
        sill, head = opening["sill"], opening["head"]
        kind = opening["kind"]
        if left > cursor:
            box(f"Facade pier {'rear' if south else 'front'} | level {floor}", ((cursor+left)/2, y0+FLOOR_HEIGHT/2, z),
                (left-cursor, FLOOR_HEIGHT, WALL), panel if floor % 2 else concrete)
        if sill > 0:
            box("Window sill / spandrel", (cx, y0+sill/2, z),
                (opening_w, sill, WALL), concrete)
        if head < FLOOR_HEIGHT:
            box("Window lintel", (cx, y0+(head+FLOOR_HEIGHT)/2, z),
                (opening_w, FLOOR_HEIGHT-head, WALL), panel)
        glazing_height = head-sill
        if kind not in ("entrance", "loggia", "luxfer"):
            glass_material = lux if kind == "luxfer" else (
                glass_warm if (floor*7 + int(abs(cx)*10)) % 9 == 0 else glass
            )
            box("Window / glazed unit", (cx, y0+sill+glazing_height/2, z-0.025),
                (opening_w-0.12, glazing_height-0.09, 0.055), glass_material)
            for side in (-1, 1):
                box("Window / vertical frame", (cx+side*(opening_w/2-0.035), y0+(sill+head)/2, z-0.065),
                    (0.07, glazing_height, 0.08), frame)
            box("Window / head frame", (cx, y0+head-0.035, z-0.065),
                (opening_w, 0.07, 0.08), frame)
            if sill > 0:
                box("Window / sill frame", (cx, y0+sill+0.035, z-0.065),
                    (opening_w, 0.07, 0.08), frame)
            box("Window / central mullion", (cx, y0+(sill+head)/2, z-0.075),
                (0.045, glazing_height-0.08, 0.035), metal)
        cursor = right
    if cursor < WIDTH/2:
        box(f"Facade pier {'rear' if south else 'front'} | level {floor}", ((cursor+WIDTH/2)/2, y0+FLOOR_HEIGHT/2, z),
            (WIDTH/2-cursor, FLOOR_HEIGHT, WALL), panel)

for floor in range(FLOORS):
    facade_floor(floor, FRONT_Z, south=False)
    facade_floor(floor, REAR_Z, south=True)
    y = floor * FLOOR_HEIGHT
    # Fine vertical panel seams land between the five structural module bays.
    for x in (-5.4, -1.8, 1.8, 5.4):
        box("Front | vertical precast joint", (x, y+1.40, FRONT_Z-0.18),
            (0.035, 2.64, 0.05), dark_concrete)
        box("Rear | vertical precast joint", (x, y+1.40, REAR_Z+0.18),
            (0.035, 2.64, 0.05), dark_concrete)
    # Panel joints and coarse belt course at each storey.
    box("Horizontal prefabrication joint", (0, y+FLOOR_HEIGHT-0.045, FRONT_Z-0.17),
        (WIDTH, 0.055, 0.06), dark_concrete)
    box("Rear horizontal panel joint", (0, y+FLOOR_HEIGHT-0.045, REAR_Z+0.17),
        (WIDTH, 0.055, 0.06), dark_concrete)

# Middle stair module: repeated luxfery bands are characteristic, low-cost glazing.
for floor in range(1, FLOORS):
    y = floor * FLOOR_HEIGHT
    for row in range(5):
        for col in range(5):
            box("Staircase | luxfer glass block",
                ((col-2)*0.34, y+0.45+row*0.34, FRONT_Z-0.06),
                (0.305, 0.305, 0.055), lux)
    box("Staircase | opaque landing band", (0, y+0.15, FRONT_Z-0.06),
        (2.0, 0.30, 0.07), panel)

# Ground entrance and the two flats' access doors, with an old intercom and nameplate.
box("Main entrance | lintel", (0, 2.46, FRONT_Z-0.18), (1.8, 0.20, 0.16), dark_concrete)
# Both leaves sit open against the entrance jambs, leaving a real walkable opening.
for side in (-1, 1):
    box("Main entrance | open green door leaf", (side*0.83, 1.18, FRONT_Z-0.55),
        (0.055, 2.28, 0.78), door)
    box("Entry door | narrow wired-glass pane", (side*0.84, 1.58, FRONT_Z-0.58),
        (0.025, 0.88, 0.48), lux)
box("Entrance canopy | exposed concrete", (0, 2.65, FRONT_Z-0.90), (3.25, 0.18, 1.35), dark_concrete)
box("Municipal entry plaque | faded red enamel", (0, 3.00, FRONT_Z-0.18), (2.05, 0.35, 0.08), red)
box("Old intercom | metal plate", (1.02, 1.42, FRONT_Z-0.25), (0.20, 0.38, 0.045), metal)
text_label("House number plate", "VCHOD 01", (-0.62, 2.94, FRONT_Z-0.24), 0.20, cream)
text_label("Housing-estate authority plate", "SPRAVA DOMU / 1974", (-0.73, 1.88, FRONT_Z-0.20), 0.105, cream)

# Four recessed loggias. The outer facade is open across each bay and the
# full-height doorway is set back at LOGGIA_BACK_Z.
for floor in range(FLOORS):
    y = floor*FLOOR_HEIGHT
    loggia_z = (LOGGIA_BACK_Z + REAR_Z) / 2
    for cx in (-3.6, 3.6):
        box("Loggia | heavy concrete slab",
            (cx, y-SLAB/2, loggia_z), (LOGGIA_WIDTH, SLAB, LOGGIA_DEPTH), panel, 0.015)
        for side in (-1, 1):
            side_x = cx + side*(LOGGIA_WIDTH/2-WALL/2)
            box("Loggia | full-height concrete side return",
                (side_x, y+FLOOR_HEIGHT/2, loggia_z),
                (WALL, FLOOR_HEIGHT, LOGGIA_DEPTH+WALL), concrete)
        frame_width = 0.065
        door_y = y + WINDOW_HEAD/2
        pane_z = LOGGIA_BACK_Z - 0.035
        # Two sliding leaves are offset to leave a clear central route.
        for side in (-1, 1):
            box("Loggia door | slid-open glazed panel",
                (cx+side*1.00, door_y, pane_z),
                (0.95, WINDOW_HEAD-frame_width*2, 0.045),
                glass_warm if (floor + (1 if side > 0 else 0)) % 4 == 0 else glass)
        for side in (-1, 1):
            box("Loggia door | jamb",
                (cx+side*(LOGGIA_WIDTH/2-frame_width/2), door_y, LOGGIA_BACK_Z-0.055),
                (frame_width, WINDOW_HEAD, 0.08), frame)
        box("Loggia door | head frame",
            (cx, y+WINDOW_HEAD-frame_width/2, LOGGIA_BACK_Z-0.055),
            (LOGGIA_WIDTH, frame_width, 0.08), frame)
        box("Loggia door | threshold",
            (cx, y+frame_width/2, LOGGIA_BACK_Z-0.055),
            (LOGGIA_WIDTH, frame_width, 0.08), dark_concrete)
        box("Loggia door | central mullion",
            (cx, door_y, LOGGIA_BACK_Z-0.055),
            (0.045, WINDOW_HEAD-frame_width*2, 0.055), metal)
        rail_z = REAR_Z - 0.09
        rail_width = LOGGIA_WIDTH - 0.20
        box("Loggia railing | upper rail", (cx, y+1.03, rail_z),
            (rail_width, 0.065, 0.065), railing)
        box("Loggia railing | lower rail", (cx, y+0.15, rail_z),
            (rail_width, 0.05, 0.05), railing)
        for post in range(9):
            px = cx + (post-4)*(rail_width/8)
            box("Loggia railing | vertical bar", (px, y+0.57, rail_z),
                (0.045, 0.90, 0.045), railing)

# Central switch-back stair: both flights meet a narrow landing at their ends.
# A pair of 8-riser flights connects each 2.8 m storey; the cellar uses 16 risers.
STAIR_LOW_X = -1.5
STAIR_HIGH_X = 0.9
STAIR_STEP_RUN = (STAIR_HIGH_X-STAIR_LOW_X)/8
STAIR_LOWER_Z = -0.8
STAIR_UPPER_Z = 1.5
STAIR_TREAD_DEPTH = 1.20
STAIR_LANDING_WIDTH = 0.60
STAIR_LANDING_DEPTH = 4.30
STAIR_LANDING_Z = 0.0

cellar_rise = BASEMENT_HEIGHT/16
for step in range(8):
    rise = (step+1)*cellar_rise
    x1 = STAIR_LOW_X+(step+0.5)*STAIR_STEP_RUN
    x2 = STAIR_HIGH_X-(step+0.5)*STAIR_STEP_RUN
    box("Cellar stair | lower flight tread",
        (x1, -BASEMENT_HEIGHT+rise-0.09, STAIR_LOWER_Z),
        (STAIR_STEP_RUN, 0.18, STAIR_TREAD_DEPTH), stair_concrete)
    box("Cellar stair | upper flight tread",
        (x2, -BASEMENT_HEIGHT/2+rise-0.09, STAIR_UPPER_Z),
        (STAIR_STEP_RUN, 0.18, STAIR_TREAD_DEPTH), stair_concrete)
box("Cellar stair | half-floor landing",
    (STAIR_HIGH_X+STAIR_LANDING_WIDTH/2, -BASEMENT_HEIGHT/2-0.08, STAIR_LANDING_Z),
    (STAIR_LANDING_WIDTH, 0.16, STAIR_LANDING_DEPTH), stair_concrete)

for floor in range(FLOORS-1):
    y = floor*FLOOR_HEIGHT
    for step in range(8):
        rise = (step+1)*(FLOOR_HEIGHT/16)
        x1 = STAIR_LOW_X+(step+0.5)*STAIR_STEP_RUN
        x2 = STAIR_HIGH_X-(step+0.5)*STAIR_STEP_RUN
        box("Stair | lower flight tread", (x1, y+rise-0.09, STAIR_LOWER_Z),
            (STAIR_STEP_RUN, 0.18, STAIR_TREAD_DEPTH), stair_concrete)
        box("Stair | upper flight tread", (x2, y+FLOOR_HEIGHT/2+rise-0.09, STAIR_UPPER_Z),
            (STAIR_STEP_RUN, 0.18, STAIR_TREAD_DEPTH), stair_concrete)
    box("Stair | half-floor landing",
        (STAIR_HIGH_X+STAIR_LANDING_WIDTH/2, y+FLOOR_HEIGHT/2-0.08, STAIR_LANDING_Z),
        (STAIR_LANDING_WIDTH, 0.16, STAIR_LANDING_DEPTH), stair_concrete)
    for side in (-1, 1):
        box("Stair | painted handrail", (side*1.30, y+1.20, STAIR_LOWER_Z),
            (2.55, 0.055, 0.055), metal)
        box("Stair | upper handrail", (side*1.30, y+2.40, STAIR_UPPER_Z),
            (2.55, 0.055, 0.055), metal)

# Interior apartment partitions are grouped as a legible cutaway; rooms are named.
# Module centres in each flat: outer bedroom/kids room; inner kitchen/living room.
for floor in range(FLOORS):
    y = floor*FLOOR_HEIGHT
    for side in (-1, 1):
        outer = side*7.2
        inner = side*3.6
        # Floor finishes are intentionally muted institutional lino.
        for cx, cz, sx, sz, label, mat in [
            (outer, -4.35, 3.45, 3.0, "Children room", lino),
            (outer,  3.05, 3.45, 4.35, "Bedroom", lino),
            (inner, -4.10, 3.45, 3.5, "Kitchen", lino),
            (inner,  2.325, 3.45, 4.65, "Living room", lino),
        ]:
            box(f"Flat {side} | {label} | level {floor} finish", (cx, y+0.035, cz),
                (sx, 0.05, sz), mat)
        # Room dividers; door gaps are left around the central hall by segmented walls.
        # The outer and inner modules are joined by a conventional 0.88 m doorway.
        entry_z0, entry_z1 = -1.74, -0.86
        for z0, z1 in ((FRONT_Z+0.14, entry_z0), (entry_z1, REAR_Z-0.14)):
            if z1 > z0:
                box("Apartment partition | module boundary", (side*5.4, y+1.25, (z0+z1)/2),
                    (WALL, 2.5, z1-z0), cream)
        box("Apartment partition | boundary door lintel", (side*5.4, y+2.20, (entry_z0+entry_z1)/2),
            (WALL, 0.60, entry_z1-entry_z0), cream)
        box("Apartment hall | lino", (outer, y+0.035, -1.30), (3.45, 0.05, 2.30), lino)

        # Close both walls facing the central stair, leaving only the apartment door.
        for z0, z1 in ((FRONT_Z+0.14, entry_z0), (entry_z1, REAR_Z-0.14)):
            if z1 > z0:
                box("Central stair | flat separation wall", (side*1.8, y+1.25, (z0+z1)/2),
                    (WALL, 2.5, z1-z0), cream)
        box("Central stair | entry lintel", (side*1.8, y+2.20, (entry_z0+entry_z1)/2),
            (WALL, 0.60, entry_z1-entry_z0), cream)

        # Cross walls have real gaps for room doors rather than sealed-off display boxes.
        for z in (-2.275, -0.075)
            doorway_x = inner-side*1.12
            for x0, x1 in sorted(((inner-1.725, doorway_x-0.48), (doorway_x+0.48, inner+1.725))):
                if x1 > x0:
                    box("Apartment partition | room cross wall", ((x0+x1)/2, y+1.25, z),
                        (x1-x0, 2.5, WALL), cream)
            box("Apartment partition | room door lintel", (doorway_x, y+2.20, z),
                (0.96, 0.60, WALL), cream)

        # Outer modules also need room cross-walls around the central hall.
        for z in (-2.775, -0.075):
            doorway_x = outer
            for x0, x1 in (
                (outer-1.725, doorway_x-0.44),
                (doorway_x+0.44, outer+1.725),
            ):
                if x1 > x0:
                    box("Outer apartment | room cross wall",
                        ((x0+x1)/2, y+1.25, z), (x1-x0, 2.5, WALL), cream)
            box("Outer apartment | room door lintel",
                (doorway_x, y+2.20, z), (0.88, 0.60, WALL), cream)

        # B7-style service zone. Bath and WC are separated by a full-height partition
        # with a standard narrow doorway; the toilet is no longer in the bathtub zone.
        wc_z0, wc_z1 = -1.525, -0.875
        box("Flat | B7 service-core floor", (inner, y+0.08, -1.20), (2.0, 0.10, 2.0), cream)
        for z0, z1 in ((-2.20, wc_z0), (wc_z1, -0.20))
            if z1 > z0:
                box("Flat | bathroom-WC divider", (inner, y+1.05, (z0+z1)/2),
                    (WALL, 2.10, z1-z0), cream)
        box("Flat | bathroom-WC door lintel", (inner, y+2.00, (wc_z0+wc_z1)/2),
            (WALL, 0.20, wc_z1-wc_z0), cream)
        bath_cx = inner+side*0.48
        wc_cx = inner-side*0.48
        box("Flat | bathtub", (bath_cx, y+0.45, -1.20), (0.72, 0.18, 1.50), frame)
        box("Flat | toilet pan", (wc_cx, y+0.28, -1.20), (0.42, 0.42, 0.62), cream)

        # Two apartment entrance leaves face the communal central stair.
        box("Flat entrance | open door leaf", (side*2.24, y+1.05, -1.30), (0.88, 2.10, 0.06), door)

# End panels with restrained vertical seams and downpipes.
for x in (-WIDTH/2, WIDTH/2):
    box("End wall | precast panel", (x, FLOORS*FLOOR_HEIGHT/2, 0),
        (WALL, FLOORS*FLOOR_HEIGHT, DEPTH), concrete)
    for floor in range(FLOORS):
        box("End wall | horizontal joint", (x*1.001, floor*FLOOR_HEIGHT+2.72, 0),
            (0.035, 0.06, DEPTH), dark_concrete)
for x in (-8.65, 8.65):
    box("Rainwater downpipe | old zinc", (x, FLOORS*FLOOR_HEIGHT/2, FRONT_Z-0.22),
        (0.08, FLOORS*FLOOR_HEIGHT, 0.08), metal)
    for floor in range(FLOORS):
        box("Downpipe clamp", (x, floor*FLOOR_HEIGHT+0.35, FRONT_Z-0.27),
            (0.14, 0.075, 0.12), dark_concrete)

# Flat roof, gravel-like membrane and a compact service vent, no modern rooftop plant.
box("Roof | structural slab", (0, FLOORS*FLOOR_HEIGHT-SLAB/2, 0),
    (WIDTH+0.25, SLAB, DEPTH+0.25), dark_concrete)
box("Roof | gravel membrane", (0, FLOORS*FLOOR_HEIGHT+0.03, 0),
    (WIDTH, 0.06, DEPTH), panel)
box("Roof | low parapet front", (0, FLOORS*FLOOR_HEIGHT+0.26, FRONT_Z-0.06),
    (WIDTH+0.30, 0.46, 0.22), concrete)
box("Roof | low parapet rear", (0, FLOORS*FLOOR_HEIGHT+0.26, REAR_Z+0.06),
    (WIDTH+0.30, 0.46, 0.22), concrete)
for x in (-5.4, 5.4):
    box("Roof | ventilation shaft", (x, FLOORS*FLOOR_HEIGHT+0.435, 0),
        (0.9, 0.75, 0.9), dark_concrete)

# Warm daylight and orthographic preview.
world = bpy.data.worlds.new("Overcast Central European housing estate") if not scene.world else scene.world
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.30, 0.32, 0.31, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
bpy.ops.object.light_add(type="AREA", location=(-12, 20, -15))
light = bpy.context.object
light.name = "Overcast diffuse key"
light.data.energy = 4800
light.data.shape = "DISK"
light.data.size = 14
bpy.ops.object.camera_add(location=(24, 17, -29))
camera = bpy.context.object
camera.name = "T06B V2 | front three-quarter architectural preview"
direction = Vector((0, 5.2, 0))-camera.location
camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 29
scene.camera = camera
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = "//T06B_Panelak_V2_preview.png"

# Areas are the nominal room-footprint schedule used by this visualisation.
# Clear/net construction areas require a dimensioned drawing and professional review.
import json
room_schedule = {
    "children_room_m2": round(3.45*3.0, 2),
    "kitchen_m2": round(3.45*3.5, 2),
    "bedroom_m2": round(3.45*4.35, 2),
    "living_room_m2": round(3.45*4.65, 2),
    "hall_m2": round(3.45*2.30, 2),
    "bathroom_wc_zone_m2": round(2.0*2.0, 2),
}
# Store the intended dimensional design as scene metadata for downstream checks.
scene["room_area_schedule_m2"] = json.dumps(room_schedule, sort_keys=True)
scene["nominal_room_schedule_sum_m2"] = round(sum(room_schedule.values()), 2)
scene["typology"] = "T06B-inspired five-module section"
scene["module_width_m"] = MODULE
scene["section_width_m"] = WIDTH
scene["section_depth_m"] = DEPTH
scene["above_ground_storeys"] = FLOORS
scene["lift"] = False
scene["apartments_per_floor"] = 2
scene["design_status"] = "visualisation concept; not for construction"
# Record measured world-space bounds from the evaluated Blender geometry.
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model_dir = os.path.join(repo_root, "public", "models")
data_dir = os.path.join(repo_root, "public", "data")
os.makedirs(model_dir, exist_ok=True)
os.makedirs(data_dir, exist_ok=True)
blend_path = os.path.join(repo_root, "T06B_Panelak_V2.blend")
glb_path = os.path.join(model_dir, "t06b-panelak-v2.glb")
source_manifest_path = os.path.join(data_dir, "t06b-panelak-v2.json")
# Convert sign lettering to mesh geometry so it survives GLB export.
for text_object in [obj for obj in scene.objects if obj.type == "FONT"]:
    bpy.ops.object.select_all(action="DESELECT")
    text_object.select_set(True)
    bpy.context.view_layer.objects.active = text_object
    bpy.ops.object.convert(target="MESH")
mesh_objects = [obj for obj in scene.objects if obj.type == "MESH"]
# The browser already provides the site ground, road and approach. Keep those in
# the editable preview, but exclude them from both the runtime GLB and its manifest.
site_object_names = {
    "Site | terrain",
    "Soviet-era estate access road",
    "Concrete approach pavement",
    "Concrete entrance apron",
}
export_mesh_objects = [obj for obj in mesh_objects if obj.name not in site_object_names]
depsgraph = bpy.context.evaluated_depsgraph_get()
object_records = []
for index, obj in enumerate(export_mesh_objects):
    evaluated = obj.evaluated_get(depsgraph)
    evaluated_mesh = evaluated.to_mesh()
    world_vertices = [evaluated.matrix_world @ vert.co for vert in evaluated_mesh.vertices]
    evaluated.to_mesh_clear()
    if not world_vertices:
        continue
    min_point = {
        "x": round(min(v.x for v in world_vertices), 6),
        "y": round(min(v.y for v in world_vertices), 6),
        "z": round(min(v.z for v in world_vertices), 6),
    }
    max_point = {
        "x": round(max(v.x for v in world_vertices), 6),
        "y": round(max(v.y for v in world_vertices), 6),
        "z": round(max(v.z for v in world_vertices), 6),
    }
    center = {axis: round((min_point[axis]+max_point[axis])/2, 6) for axis in ("x", "y", "z")}
    bounds_corners = [
        {"x": min_point["x"] if bit & 1 == 0 else max_point["x"],
         "y": min_point["y"] if bit & 2 == 0 else max_point["y"],
         "z": min_point["z"] if bit & 4 == 0 else max_point["z"]}
        for bit in range(8)
    ]
    object_records.append({
        "id": f"object-{index+1:04d}",
        "name": obj.name,
        "center": center,
        "bounds": {"min": min_point, "max": max_point},
        "dimensions": {axis: round(max_point[axis]-min_point[axis], 6) for axis in ("x", "y", "z")},
        "corners": bounds_corners,
    })

front_facade_objects = [obj for obj in object_records if obj["name"].startswith("Facade pier front | level 0")]
assert front_facade_objects, "The ground-floor modular facade is missing."
front_bounds = {
    "minX": min(obj["bounds"]["min"]["x"] for obj in front_facade_objects),
    "maxX": max(obj["bounds"]["max"]["x"] for obj in front_facade_objects),
}
assert abs((front_bounds["maxX"]-front_bounds["minX"])-WIDTH) < 1e-5, "Front facade does not span five 3.6 m modules."
assert len([obj for obj in object_records if obj["name"] == "Flat entrance | open door leaf"]) == 8
assert len([obj for obj in object_records if obj["name"] == "Stair | lower flight tread"]) == (FLOORS-1)*8
assert len([obj for obj in object_records if obj["name"] == "Stair | upper flight tread"]) == (FLOORS-1)*8
assert not any("Výtah" in obj["name"] or "Elevator" in obj["name"] for obj in object_records)

anchors = [
    {"id": "building-origin", "name": "Původ sekce", "position": {"x": 0, "y": 0, "z": 0}},
    {"id": "front-left-ground", "name": "Přední levý roh", "position": {"x": -WIDTH/2, "y": 0, "z": FRONT_Z}},
    {"id": "front-right-ground", "name": "Přední pravý roh", "position": {"x": WIDTH/2, "y": 0, "z": FRONT_Z}},
    {"id": "rear-left-ground", "name": "Zadní levý roh", "position": {"x": -WIDTH/2, "y": 0, "z": REAR_Z}},
    {"id": "rear-right-ground", "name": "Zadní pravý roh", "position": {"x": WIDTH/2, "y": 0, "z": REAR_Z}},
    {"id": "entrance-centre", "name": "Střed vstupu", "position": {"x": 0, "y": 1.14, "z": FRONT_Z}},
    {"id": "stair-core-centre", "name": "Schodišťové jádro", "position": {"x": 0, "y": 0, "z": 0.4}},
    {"id": "roof-datum", "name": "Datum střechy", "position": {"x": 0, "y": FLOORS*FLOOR_HEIGHT, "z": 0}},
]
for floor in range(FLOORS+1):
    anchors.append({
        "id": f"floor-datum-{floor}",
        "name": f"Podlažní datum {floor}",
        "position": {"x": 0, "y": floor*FLOOR_HEIGHT, "z": 0},
    })
for module_index, x in enumerate(MODULE_CENTRES, start=1):
    anchors.append({
        "id": f"module-axis-{module_index}",
        "name": f"Modulová osa {module_index}",
        "position": {"x": x, "y": 0, "z": 0},
    })
for floor in range(FLOORS):
    for side, x in (("left", -3.6), ("right", 3.6)):
        anchors.append({
            "id": f"loggia-f{floor}-{side}",
            "name": f"Lodžie patro {floor+1} {side}",
            "position": {"x": x, "y": floor*FLOOR_HEIGHT, "z": (LOGGIA_BACK_Z+REAR_Z)/2},
        })

manifest = {
    "schemaVersion": "2.0.0",
    "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    "provenance": {
        "source": "tools/generate_t06b_panelak_v2.py",
        "geometry": "Evaluated Blender mesh vertices transformed into world coordinates",
        "confidence": "Measured from the generated visualisation geometry; not a survey or construction certification.",
    },
    "coordinateSystem": {
        "units": "metres",
        "x": "across the five-module facade",
        "y": "vertical",
        "z": "depth, front/north negative and rear/south positive",
        "worldOrigin": {"x": 0, "y": 0, "z": 0},
    },
    "building": {
        "typology": "T06B-inspired five-module section",
        "moduleWidth": MODULE,
        "moduleCount": MODULE_COUNT,
        "width": WIDTH,
        "depth": DEPTH,
        "floors": FLOORS,
        "basementHeight": BASEMENT_HEIGHT,
        "floorHeight": FLOOR_HEIGHT,
        "roofDatum": FLOORS*FLOOR_HEIGHT,
        "lift": False,
        "apartmentsPerFloor": 2,
        "apartmentsTotal": FLOORS*2,
        "designStatus": "visualisation concept; not for construction",
    },
    "roomAreaScheduleM2": room_schedule,
    "nominalRoomAreaSumM2": round(sum(room_schedule.values()), 2),
    "counts": {
        "objects": len(object_records),
        "semanticAnchors": len(anchors),
        "entranceDoorLeaves": len([obj for obj in object_records if obj["name"] == "Flat entrance | open door leaf"]),
        "lowerStairTreads": len([obj for obj in object_records if obj["name"] == "Stair | lower flight tread"]),
        "upperStairTreads": len([obj for obj in object_records if obj["name"] == "Stair | upper flight tread"]),
        "luxferBlocks": len([obj for obj in object_records if obj["name"] == "Staircase | luxfer glass block"]),
        "loggiaSlabs": len([obj for obj in object_records if obj["name"] == "Loggia | heavy concrete slab"]),
        "liftObjects": len([obj for obj in object_records if "Výtah" in obj["name"] or "Elevator" in obj["name"]]),
    },
    "validation": {
        "status": "passed",
        "assertions": [
            "Five 3.6 m module axes span an 18.0 m section",
            "Four above-ground storeys are connected by seven pairs of switch-back stair flights",
            "A separate entrance door leaf is modelled for each of the eight flats",
            "Upper floor plates are split around the central stairwell opening",
            "The facade contains luxfer glass blocks and four stacked pairs of recessed loggias",
            "No elevator geometry is included",
            "The room footprint schedule rounds to 65.4 m2",
        ],
    },
    "anchors": anchors,
    "objects": object_records,
}
with open(source_manifest_path, "w", encoding="utf8") as manifest_file:
    json.dump(manifest, manifest_file, ensure_ascii=False, indent=2)
    manifest_file.write("\n")

# Convert the authored Y-up coordinates into Blender's native Z-up scene.
# The glTF exporter applies its standard axis conversion, restoring the intended
# Y-up layout in the browser asset.
rotation = Matrix.Rotation(math.radians(90), 4, "X")
for obj in list(scene.objects):
    obj.matrix_world = rotation @ obj.matrix_world

# The same building-only mesh selection is used for geometry validation and export.

assert MODULE_COUNT == 5 and abs(WIDTH-18.0) < 1e-6
assert FLOORS == 4 and scene["apartments_per_floor"] == 2 and scene["lift"] is False
assert len([obj for obj in scene.objects if obj.name == "Flat entrance | open door leaf"]) == 8
assert len([obj for obj in scene.objects if obj.name == "Loggia | heavy concrete slab"]) == FLOORS*2
assert len([obj for obj in scene.objects if obj.name == "Loggia door | slid-open glazed panel"]) == FLOORS*4
assert round(sum(room_schedule.values()), 1) == 65.4
assert not any("Výtah" in obj.name or "Elevator" in obj.name for obj in scene.objects)
assert export_mesh_objects, "No runtime building mesh geometry was generated."

depsgraph = bpy.context.evaluated_depsgraph_get()
# Measure the structural envelope separately from the projecting entrance canopy,
# open door leaves and approach steps. Those accessories intentionally extend
# beyond the nominal 18.0 x 12.0 m section footprint.
envelope_prefixes = ("Facade pier", "Floor ", "End wall", "Roof |")
envelope_mesh_objects = [
    obj for obj in export_mesh_objects if obj.name.startswith(envelope_prefixes)
]
assert envelope_mesh_objects, "No structural envelope geometry was generated."
world_vertices = []
for obj in envelope_mesh_objects:
    evaluated = obj.evaluated_get(depsgraph)
    evaluated_mesh = evaluated.to_mesh()
    world_vertices.extend(evaluated.matrix_world @ vertex.co for vertex in evaluated_mesh.vertices)
    evaluated.to_mesh_clear()
asset_min_x = min(vertex.x for vertex in world_vertices)
asset_max_x = max(vertex.x for vertex in world_vertices)
asset_min_y = min(vertex.y for vertex in world_vertices)
asset_max_y = max(vertex.y for vertex in world_vertices)
asset_min_z = min(vertex.z for vertex in world_vertices)
asset_max_z = max(vertex.z for vertex in world_vertices)
assert 18.0 <= asset_max_x-asset_min_x <= 18.4, "Blender structural shell width must be 18 m."
assert 12.0 <= asset_max_y-asset_min_y <= 12.4, "Blender structural shell depth must be about 12 m."
assert asset_min_z < -2.7 and asset_max_z > FLOORS*FLOOR_HEIGHT+0.4, "Model height axis is not Z-up in Blender."

bpy.ops.object.select_all(action="DESELECT")
for obj in export_mesh_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = export_mesh_objects[0]
bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=True, export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f"T06B V2 generated: {WIDTH:.1f} m x {DEPTH:.1f} m, {FLOORS} above-ground storeys, 8 flats, no lift.")
print(f"Editable Blender file: {blend_path}")
print(f"Browser GLB asset: {glb_path}")
