"""Generate a four-storey, five-module Czechoslovak T06B-inspired panel block.

Run with Blender:
    blender --background --python tools/generate_t06b_panelak_v2.py

Coordinates are metres. This is a game/visualisation concept model, not a
construction-ready or standards-certified architectural design.
"""
import bpy
import math
from mathutils import Vector

MODULE = 3.6
MODULE_COUNT = 5
WIDTH = MODULE * MODULE_COUNT  # 18.0 m
DEPTH = 11.4
FLOORS = 4                    # 4 above-ground storeys; no lift
FLOOR_HEIGHT = 2.8
BASEMENT_HEIGHT = 2.6
SLAB = 0.18
WALL = 0.18
WINDOW_W = 1.35
WINDOW_SILL = 0.78
WINDOW_HEAD = 2.18
FRONT_Z = -DEPTH / 2
REAR_Z = DEPTH / 2
MODULE_CENTRES = [-7.2, -3.6, 0.0, 3.6, 7.2]

def material(name, color, roughness=0.85, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = metallic
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

def text_label(name, body, loc, size, mat, rotation=(math.pi/2, 0, 0)):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body
    curve.size = size
    curve.extrude = 0.001
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rotation
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
box("Site | terrain", (0, -BASEMENT_HEIGHT-0.16, 0), (90, 0.25, 90), grass)
box("Soviet-era estate access road", (0, -BASEMENT_HEIGHT+0.005, -13), (90, 0.04, 5.5), asphalt)
box("Concrete entrance apron", (0, -BASEMENT_HEIGHT+0.035, FRONT_Z-2.2), (7.5, 0.07, 4.2), panel)

# Four levels over a cellar. The cellar is visible as a modelled foundation band.
for floor in range(-1, FLOORS):
    base_y = -BASEMENT_HEIGHT if floor == -1 else floor * FLOOR_HEIGHT
    height = BASEMENT_HEIGHT if floor == -1 else FLOOR_HEIGHT
    box(f"Floor {floor} | structural slab", (0, base_y + SLAB/2, 0),
        (WIDTH, SLAB, DEPTH), stair_concrete if floor == -1 else panel)

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
    centers = [-7.2, -3.6, 3.6, 7.2]
    for cx in centers:
        is_loggia_door = south and abs(abs(cx)-3.6) < 0.01
        opening_w = 1.55 if is_loggia_door else WINDOW_W
        sill = 0.05 if is_loggia_door else WINDOW_SILL
        opening_left = cx-opening_w/2
        opening_right = cx+opening_w/2
        pier_left = -WIDTH/2
        for edge in [opening_left, opening_right]:
            if edge > pier_left:
                box(f"Facade pier | level {floor}", ((pier_left+edge)/2, y0+FLOOR_HEIGHT/2, z),
                    (edge-pier_left, FLOOR_HEIGHT, WALL), panel if floor % 2 else concrete)
            pier_left = edge
        if pier_left < WIDTH/2:
            box(f"Facade pier | level {floor}", ((pier_left+WIDTH/2)/2, y0+FLOOR_HEIGHT/2, z),
                (WIDTH/2-pier_left, FLOOR_HEIGHT, WALL), panel)
        if sill > 0:
            box("Window sill / spandrel", (cx, y0+sill/2, z),
                (opening_w, sill, WALL), concrete)
        box("Window lintel", (cx, y0+(WINDOW_HEAD+FLOOR_HEIGHT)/2, z),
            (opening_w, FLOOR_HEIGHT-WINDOW_HEAD, WALL), panel)
        glazing_height = WINDOW_HEAD-sill
        glass_material = glass_warm if (floor*7 + int(abs(cx)*10)) % 9 == 0 else glass
        if is_loggia_door:
            # A low threshold, not a conventional sill, makes a walkable loggia door.
            glazing_height = WINDOW_HEAD-sill
        box("Window / glazed unit", (cx, y0+sill+glazing_height/2, z-0.025),
            (opening_w-0.12, glazing_height-0.09, 0.055), glass_material)
        for side in (-1, 1):
            box("Window / vertical frame", (cx+side*(opening_w/2-0.035), y0+(sill+WINDOW_HEAD)/2, z-0.065),
                (0.07, WINDOW_HEAD-sill, 0.08), frame)
        box("Window / head frame", (cx, y0+WINDOW_HEAD-0.035, z-0.065),
            (opening_w, 0.07, 0.08), frame)
        if sill > 0:
            box("Window / sill frame", (cx, y0+sill+0.035, z-0.065),
                (opening_w, 0.07, 0.08), frame)
        box("Window / central mullion", (cx, y0+(sill+WINDOW_HEAD)/2, z-0.075),
            (0.045, WINDOW_HEAD-sill-0.08, 0.035), metal)

for floor in range(FLOORS):
    facade_floor(floor, FRONT_Z, south=False)
    facade_floor(floor, REAR_Z, south=True)
    y = floor * FLOOR_HEIGHT
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
                ((col-2)*0.31, y-0.25+row*0.31, FRONT_Z-0.19),
                (0.285, 0.285, 0.055), lux)
    box("Staircase | opaque landing band", (0, y+0.15, FRONT_Z-0.17),
        (3.6, 0.30, 0.07), panel)

# Ground entrance and the two flats' access doors, with an old intercom and nameplate.
box("Main entrance | lintel", (0, 2.46, FRONT_Z-0.18), (1.8, 0.20, 0.16), dark_concrete)
box("Main entrance | green double door", (0, 1.18, FRONT_Z-0.20), (1.48, 2.28, 0.08), door)
for side in (-1, 1):
    box("Entry door | narrow wired-glass pane", (side*0.42, 1.60, FRONT_Z-0.25),
        (0.22, 0.90, 0.025), lux)
box("Entrance canopy | exposed concrete", (0, 2.65, FRONT_Z-0.90), (3.25, 0.18, 1.35), dark_concrete)
box("Old intercom | metal plate", (1.02, 1.42, FRONT_Z-0.25), (0.20, 0.38, 0.045), metal)
text_label("House number plate", "VCHOD 01", (-0.63, 2.88, FRONT_Z-0.30), 0.20, cream)

# Four module-aligned recessed loggias, stacked in four repeated levels.
for floor in range(FLOORS):
    y = floor*FLOOR_HEIGHT
    for cx in (-3.6, 3.6):
        box("Loggia | heavy concrete slab", (cx, y-0.025, REAR_Z-0.75), (2.55, 0.18, 1.55), panel, 0.015)
        box("Loggia | side reveal left", (cx-1.22, y+0.90, REAR_Z-0.10), (0.10, 1.70, 1.3), concrete)
        box("Loggia | side reveal right", (cx+1.22, y+0.90, REAR_Z-0.10), (0.10, 1.70, 1.3), concrete)
        box("Loggia railing | upper rail", (cx, y+1.03, REAR_Z-1.48), (2.42, 0.065, 0.065), railing)
        box("Loggia railing | lower rail", (cx, y+0.15, REAR_Z-1.48), (2.42, 0.05, 0.05), railing)
        for post in range(7):
            px = cx+(post-3)*0.36
            box("Loggia railing | vertical bar", (px, y+0.59, REAR_Z-1.48), (0.045, 0.90, 0.045), railing)

# Central switch-back stair: two runs and an intermediate landing per storey.
for floor in range(FLOORS-1):
    y = floor*FLOOR_HEIGHT
    for step in range(8):
        rise = (step+1)*(FLOOR_HEIGHT/16)
        x1 = -1.22+(step+0.5)*0.305
        x2 = 1.22-(step+0.5)*0.305
        box("Stair | lower flight tread", (x1, y+rise-0.09, -0.55), (0.33, 0.18, 1.35), stair_concrete)
        box("Stair | upper flight tread", (x2, y+FLOOR_HEIGHT/2+rise-0.09, 1.35), (0.33, 0.18, 1.35), stair_concrete)
    box("Stair | half-floor landing", (0, y+FLOOR_HEIGHT/2-0.08, 0.40), (2.7, 0.16, 3.3), stair_concrete)
    for side in (-1, 1):
        box("Stair | painted handrail", (side*1.30, y+1.20, -0.55), (2.55, 0.055, 0.055), metal)
        box("Stair | upper handrail", (side*1.30, y+2.40, 1.35), (2.55, 0.055, 0.055), metal)

# Interior apartment partitions are grouped as a legible cutaway; rooms are named.
# Module centres in each flat: outer bedroom/kids room; inner kitchen/living room.
for floor in range(FLOORS):
    y = floor*FLOOR_HEIGHT
    for side in (-1, 1):
        outer = side*7.2
        inner = side*3.6
        # Floor finishes are intentionally muted institutional lino.
        for cx, cz, sx, sz, label, mat in [
            (outer, -3.75, 3.42, 3.0, "Children room", lino),
            (outer,  3.05, 3.42, 4.35, "Bedroom", lino),
            (inner, -3.50, 3.42, 3.5, "Kitchen", lino),
            (inner,  3.00, 3.42, 4.65, "Living room", lino),
        ]:
            box(f"Flat {side} | {label} | level {floor} finish", (cx, y+0.035, cz),
                (sx, 0.05, sz), mat)
        # Room dividers; door gaps are left around the central hall by segmented walls.
        for x in (side*5.4,):
            box("Apartment partition | module boundary", (x, y+1.25, 0.0),
                (WALL, 2.5, DEPTH-0.3), cream)
        for z in (-1.95, 0.80):
            box("Apartment partition | cross wall", (inner, y+1.25, z),
                (3.42, 2.5, WALL), cream)
        # B7-style service core: simple cream/green bathroom and separate WC blocks.
        box("Flat | B7 bathroom core", (inner, y+0.08, -0.42), (2.10, 0.10, 2.20), cream)
        box("Flat | B7 bath enclosure", (inner+side*0.42, y+1.0, -0.65), (0.78, 1.0, 1.55), frame)
        box("Flat | B7 WC enclosure", (inner-side*0.50, y+1.0, -0.65), (0.72, 1.0, 1.1), cream)

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
box("Roof | structural slab", (0, FLOORS*FLOOR_HEIGHT+0.06, 0),
    (WIDTH+0.25, 0.18, DEPTH+0.25), dark_concrete)
box("Roof | gravel membrane", (0, FLOORS*FLOOR_HEIGHT+0.16, 0),
    (WIDTH, 0.06, DEPTH), panel)
box("Roof | low parapet front", (0, FLOORS*FLOOR_HEIGHT+0.42, FRONT_Z-0.06),
    (WIDTH+0.30, 0.46, 0.22), concrete)
box("Roof | low parapet rear", (0, FLOORS*FLOOR_HEIGHT+0.42, REAR_Z+0.06),
    (WIDTH+0.30, 0.46, 0.22), concrete)
for x in (-5.4, 5.4):
    box("Roof | ventilation shaft", (x, FLOORS*FLOOR_HEIGHT+0.55, 0),
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

# Store the intended dimensional design as scene metadata for downstream checks.
scene["typology"] = "T06B-inspired five-module section"
scene["module_width_m"] = MODULE
scene["section_width_m"] = WIDTH
scene["section_depth_m"] = DEPTH
scene["above_ground_storeys"] = FLOORS
scene["lift"] = False
scene["apartments_per_floor"] = 2
scene["design_status"] = "visualisation concept; not for construction"
bpy.ops.wm.save_as_mainfile(filepath="//T06B_Panelak_V2.blend")
print("T06B V2 generated: 18.0 m x 11.4 m, 4 above-ground storeys, 8 flats, no lift.")
