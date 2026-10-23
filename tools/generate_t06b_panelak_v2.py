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
WALL = 0.15
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
    mat = stair_concrete if floor == -1 else panel
    if floor < 0:
        box(f"Floor {floor} | structural slab", (0, base_y + SLAB/2, 0),
            (WIDTH, SLAB, DEPTH), mat)
    else:
        # Keep the central stair opening truly open through the upper slabs.
        core_left, core_right = -1.5, 1.5
        core_front, core_rear = -1.4, 2.2
        side_width = WIDTH/2-core_right
        box(f"Floor {floor} | left slab wing", ((-WIDTH/2+core_left)/2, base_y+SLAB/2, 0),
            (side_width, SLAB, DEPTH), mat)
        box(f"Floor {floor} | right slab wing", ((core_right+WIDTH/2)/2, base_y+SLAB/2, 0),
            (side_width, SLAB, DEPTH), mat)
        box(f"Floor {floor} | slab before stair core", (0, base_y+SLAB/2, (FRONT_Z+core_front)/2),
            (core_right-core_left, SLAB, core_front-FRONT_Z), mat)
        box(f"Floor {floor} | slab after stair core", (0, base_y+SLAB/2, (core_rear+REAR_Z)/2),
            (core_right-core_left, SLAB, REAR_Z-core_rear), mat)

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
            "x": cx, "width": 1.55 if is_loggia_door else WINDOW_W,
            "sill": 0.05 if is_loggia_door else WINDOW_SILL,
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
            box(f"Facade pier | level {floor}", ((cursor+left)/2, y0+FLOOR_HEIGHT/2, z),
                (left-cursor, FLOOR_HEIGHT, WALL), panel if floor % 2 else concrete)
        if sill > 0:
            box("Window sill / spandrel", (cx, y0+sill/2, z),
                (opening_w, sill, WALL), concrete)
        if head < FLOOR_HEIGHT:
            box("Window lintel", (cx, y0+(head+FLOOR_HEIGHT)/2, z),
                (opening_w, FLOOR_HEIGHT-head, WALL), panel)
        glazing_height = head-sill
        if kind != "entrance":
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
        box(f"Facade pier | level {floor}", ((cursor+WIDTH/2)/2, y0+FLOOR_HEIGHT/2, z),
            (WIDTH/2-cursor, FLOOR_HEIGHT, WALL), panel)

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
                ((col-2)*0.34, y+0.45+row*0.34, FRONT_Z-0.19),
                (0.305, 0.305, 0.055), lux)
    box("Staircase | opaque landing band", (0, y+0.15, FRONT_Z-0.17),
        (2.0, 0.30, 0.07), panel)

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
        box("Loggia | side reveal left", (cx-1.22, y+0.90, REAR_Z-0.72), (0.10, 1.70, 1.35), concrete)
        box("Loggia | side reveal right", (cx+1.22, y+0.90, REAR_Z-0.72), (0.10, 1.70, 1.35), concrete)
        box("Loggia railing | upper rail", (cx, y+1.03, REAR_Z-1.48), (2.42, 0.065, 0.065), railing)
        box("Loggia railing | lower rail", (cx, y+0.15, REAR_Z-1.48), (2.42, 0.05, 0.05), railing)
        for post in range(7):
            px = cx+(post-3)*0.36
            box("Loggia railing | vertical bar", (px, y+0.59, REAR_Z-1.48), (0.045, 0.90, 0.045), railing)

# Central switch-back stair: two runs and an intermediate landing per storey.
# Basement-to-ground stair connects the cellar storage level to the entrance floor.
for step in range(12):
    rise = (step+1)*(BASEMENT_HEIGHT/12)
    x = -1.20+(step+0.5)*0.20
    box("Cellar stair | tread", (x, -BASEMENT_HEIGHT+rise-0.085, -0.55),
        (0.23, 0.17, 1.20), stair_concrete)
for side in (-1, 1):
    box("Cellar stair | handrail", (side*1.30, -1.30, -0.55),
        (2.35, 0.055, 0.055), metal)

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
            (outer, -3.75, 3.45, 3.0, "Children room", lino),
            (outer,  3.05, 3.45, 4.35, "Bedroom", lino),
            (inner, -3.50, 3.45, 3.5, "Kitchen", lino),
            (inner,  3.00, 3.45, 4.65, "Living room", lino),
        ]:
            box(f"Flat {side} | {label} | level {floor} finish", (cx, y+0.035, cz),
                (sx, 0.05, sz), mat)
        # Room dividers; door gaps are left around the central hall by segmented walls.
        # The outer and inner modules are joined by a conventional 0.88 m doorway.
        entry_z0, entry_z1 = -1.01, -0.13
        for z0, z1 in ((FRONT_Z+0.14, entry_z0), (entry_z1, REAR_Z-0.14)):
            if z1 > z0:
                box("Apartment partition | module boundary", (side*5.4, y+1.25, (z0+z1)/2),
                    (WALL, 2.5, z1-z0), cream)
        box("Apartment partition | boundary door lintel", (side*5.4, y+2.20, (entry_z0+entry_z1)/2),
            (WALL, 0.60, entry_z1-entry_z0), cream)
        box("Apartment hall | lino", (outer, y+0.035, -0.57), (3.45, 0.05, 2.30), lino)

        # Close both walls facing the central stair, leaving only the apartment door.
        for z0, z1 in ((FRONT_Z+0.14, entry_z0), (entry_z1, REAR_Z-0.14)):
            if z1 > z0:
                box("Central stair | flat separation wall", (side*1.8, y+1.25, (z0+z1)/2),
                    (WALL, 2.5, z1-z0), cream)
        box("Central stair | entry lintel", (side*1.8, y+2.20, (entry_z0+entry_z1)/2),
            (WALL, 0.60, entry_z1-entry_z0), cream)

        # Cross walls have real gaps for room doors rather than sealed-off display boxes.
        for z in (-1.95, 0.80):
            doorway_x = inner-side*1.12
            for x0, x1 in sorted(((inner-1.725, doorway_x-0.48), (doorway_x+0.48, inner+1.725))):
                if x1 > x0:
                    box("Apartment partition | room cross wall", ((x0+x1)/2, y+1.25, z),
                        (x1-x0, 2.5, WALL), cream)
            box("Apartment partition | room door lintel", (doorway_x, y+2.20, z),
                (0.96, 0.60, WALL), cream)

        # B7-style service zone. Bath and WC are separated by a full-height partition
        # with a standard narrow doorway; the toilet is no longer in the bathtub zone.
        wc_z0, wc_z1 = -0.74, -0.10
        box("Flat | B7 service-core floor", (inner, y+0.08, -0.42), (2.0, 0.10, 2.05), cream)
        for z0, z1 in ((-1.445, wc_z0), (wc_z1, 0.605)):
            if z1 > z0:
                box("Flat | bathroom-WC divider", (inner, y+1.05, (z0+z1)/2),
                    (WALL, 2.10, z1-z0), cream)
        box("Flat | bathroom-WC door lintel", (inner, y+2.00, (wc_z0+wc_z1)/2),
            (WALL, 0.20, wc_z1-wc_z0), cream)
        bath_cx = inner+side*0.48
        wc_cx = inner-side*0.48
        box("Flat | bathtub", (bath_cx, y+0.45, -0.65), (0.72, 0.18, 1.50), frame)
        box("Flat | toilet pan", (wc_cx, y+0.28, -0.28), (0.42, 0.42, 0.62), cream)

        # Two apartment entrance leaves face the communal central stair.
        box("Flat entrance | door leaf", (side*1.84, y+1.05, -0.57), (0.06, 2.10, 0.88), door)

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

# Areas are the nominal room-footprint schedule used by this visualisation.
# Clear/net construction areas require a dimensioned drawing and professional review.
import json
room_schedule = {
    "children_room_m2": round(3.45*3.0, 2),
    "kitchen_m2": round(3.45*3.5, 2),
    "bedroom_m2": round(3.45*4.35, 2),
    "living_room_m2": round(3.45*4.65, 2),
    "hall_m2": round(3.45*2.30, 2),
    "bathroom_wc_zone_m2": round(2.0*2.05, 2),
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
bpy.ops.wm.save_as_mainfile(filepath="//T06B_Panelak_V2.blend")
print("T06B V2 generated: 18.0 m x 11.4 m, 4 above-ground storeys, 8 flats, no lift.")
