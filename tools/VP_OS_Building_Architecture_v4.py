import bpy, bmesh, math, mathutils

# ===================================================================
# KONSTANTY
# ===================================================================
H_CLR, H_STR, SLAB, FAC = 2615, 2800, 150, 300
WALL_B, WALL_P, MOD = 200, 80, 3600

X_W, X_E = -12800, 12400
Y_S, Y_N = -6100, 7500
VYX1, VYX2, VYYO = -12800, -9200, 12300

LFX1, LFX2 = -2000, 5200
LFY        = Y_N + 1695
LRX1, LRX2 = 1600, 5200
LRY        = Y_S - 1200

# Východní štít - 2 lodžie kolony (F)
EGL1_Y = (-4900, -1300)
EGL2_Y = (-1300,  2300)
EGL_GAP   = 105
EGL_DEPTH_F = 1055
EGL_DEPTH_B = 1355

WINW, WINH, PARA = 1500, 1600, 850
BDW, BDH         = 900, 2300
BAR              = 60

# ===================================================================
# MATERIÁLY
# ===================================================================
def _pbr(name, col, r=0.5, m=0.0, t=0.0):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    b = mat.node_tree.nodes.get("Principled BSDF")
    b.inputs['Base Color'].default_value = (*col, 1.0)
    b.inputs['Roughness'].default_value = r
    b.inputs['Metallic'].default_value = m
    if t > 0:
        b.inputs['Transmission Weight'].default_value = t
        b.inputs['IOR'].default_value = 1.45
    return mat

def setup():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for d in [bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras]:
        for x in list(d):
            try: d.remove(x)
            except: pass
    return {
        'beton':    _pbr("Beton_Panel",       (0.48,0.48,0.48), 0.75),
        'bila':     _pbr("Bila_Fasada",       (0.92,0.92,0.90), 0.55),
        'cervena':  _pbr("Cervena_Fasada",    (0.60,0.12,0.12), 0.55),
        'umakart':  _pbr("Umakart_Krem",      (0.80,0.76,0.68), 0.38),
        'smalt':    _pbr("Smalt_Bila",        (0.95,0.95,0.95), 0.10),
        'ram':      _pbr("Ram_SlonKost",      (0.88,0.85,0.78), 0.45),
        'lino':     _pbr("Lino_Sedozelena",   (0.42,0.47,0.43), 0.43),
        'zabr':     _pbr("Zabradli_TmCervena",(0.55,0.10,0.08), 0.45, 0.4),
        'panel':    _pbr("Panel_KremPlast",   (0.88,0.82,0.62), 0.55),
        'dyha':     _pbr("Dyha_Mahagon",      (0.32,0.12,0.06), 0.25, 0.1),
        'latka':    _pbr("Latka_Horcic",      (0.55,0.42,0.10), 0.75),
        'drevo':    _pbr("Drevo",             (0.28,0.15,0.08), 0.45),
        'kov':      _pbr("Kov_Chrom",         (0.85,0.85,0.88), 0.15, 1.0),
        'kov_tm':   _pbr("Kov_Tmavy",         (0.25,0.25,0.28), 0.35, 0.8),
    }

M = setup()

# ===================================================================
# HELPERY
# ===================================================================
def _mesh(name, V, F, mat):
    me = bpy.data.meshes.new(name + "_M")
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    for v in V: bm.verts.new((v[0]/1000, v[1]/1000, v[2]/1000))
    bm.verts.ensure_lookup_table()
    for f in F:
        try: bm.faces.new([bm.verts[i] for i in f])
        except: pass
    bm.to_mesh(me); bm.free()
    if mat: ob.data.materials.append(mat)
    return ob

def box(name, cx, cy, cz, sx, sy, sz, mat):
    hx, hy, hz = sx/2, sy/2, sz/2
    V = [(-hx,-hy,-hz),(hx,-hy,-hz),(hx,hy,-hz),(-hx,hy,-hz),
         (-hx,-hy, hz),(hx,-hy, hz),(hx,hy, hz),(-hx,hy, hz)]
    F = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    ob = _mesh(name, V, F, mat)
    ob.location = (cx/1000, cy/1000, cz/1000)
    return ob

def boolean_cut(target, cx, cy, cz, sx, sy, sz, name):
    """Apply an Exact Boolean Difference. Dimensions and coordinates are millimetres."""
    cutter = box(name + "_CUTTER", cx, cy, cz, sx, sy, sz, None)
    bpy.ops.object.select_all(action='DESELECT')
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    mod = target.modifiers.new(name, 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    return target


def quad(name, V, mat):
    return _mesh(name, V, [tuple(range(len(V)))], mat)

def prism(name, foot, zb, zt, mat):
    n = len(foot)
    V = [(v[0],v[1],zb) for v in foot] + [(v[0],v[1],zt) for v in foot]
    F = [tuple(range(n-1,-1,-1)), tuple(range(n, 2*n))]
    for i in range(n):
        j = (i+1) % n; F.append((i,j,j+n,i+n))
    return _mesh(name, V, F, mat)

def cylinder(name, cx, cy, z_bot, r, h, mat, segs=12):
    V = []
    for i in range(segs):
        a = i * 2*math.pi/segs
        V.append((cx + r*math.cos(a), cy + r*math.sin(a), z_bot))
    for i in range(segs):
        a = i * 2*math.pi/segs
        V.append((cx + r*math.cos(a), cy + r*math.sin(a), z_bot + h))
    F = [tuple(range(segs-1, -1, -1)), tuple(range(segs, 2*segs))]
    for i in range(segs):
        j = (i+1) % segs; F.append((i, j, j+segs, i+segs))
    return _mesh(name, V, F, mat)

def join(objs, name):
    objs = [o for o in objs if o and o.name in bpy.data.objects]
    if not objs: return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name
    return o

# ===================================================================
# OKNA / BALKONOVÉ DVEŘE: ZÁMĚRNĚ JEN OTVORY, BEZ RÁMŮ A SKLA
# ===================================================================
def window(*args, **kwargs):
    """Compatibility wrapper. Architectural windows are Boolean voids only."""
    return []


def balcony_door(*args, **kwargs):
    """Compatibility wrapper. Balcony doors are clear apertures only."""
    return []

# ===================================================================
# STĚNY S OKNY / BD
# ===================================================================
def wall_x(x1, x2, y, gaps, thick, mat, prefix="W"):
    """One continuous wall slab with real through-cut openings. No frame/glass/leaf."""
    if x2 <= x1:
        return []
    wall = box(prefix, (x1+x2)/2, y, H_CLR/2, x2-x1, thick, H_CLR, mat)
    for idx, (gc, gw, gt) in enumerate(sorted(gaps, key=lambda g: g[0])):
        if gt == 'win':
            sill, oh = PARA, WINH
        elif gt == 'door':
            sill, oh = 0, BDH
        else:
            continue
        boolean_cut(wall, gc, y, sill+oh/2, gw, thick+100, oh,
                    f"{prefix}_Opening_{idx}_{gt}")
    return [wall]


def wall_y(y1, y2, x, gaps, thick, mat, prefix="W"):
    """One continuous wall slab with real through-cut openings. No frame/glass/leaf."""
    if y2 <= y1:
        return []
    wall = box(prefix, x, (y1+y2)/2, H_CLR/2, thick, y2-y1, H_CLR, mat)
    for idx, (gc, gw, gt) in enumerate(sorted(gaps, key=lambda g: g[0])):
        if gt == 'win':
            sill, oh = PARA, WINH
        elif gt == 'door':
            sill, oh = 0, BDH
        else:
            continue
        boolean_cut(wall, x, gc, sill+oh/2, thick+100, gw, oh,
                    f"{prefix}_Opening_{idx}_{gt}")
    return [wall]

# ===================================================================
# VNITŘNÍ PŘÍČKY S DVEŘMI
# ===================================================================
def partition_x(x1, x2, y, door_center=None, dw=800, thick=WALL_P, name="P"):
    """Interior partition with an actual doorway cut through the wall."""
    if x2 <= x1:
        return []
    wall = box(name, (x1+x2)/2, y, H_CLR/2, x2-x1, thick, H_CLR, M['beton'])
    if door_center is not None:
        dh = 1970
        boolean_cut(wall, door_center, y, dh/2, dw, thick+100, dh, name+"_DoorVoid")
    return [wall]


def partition_y(y1, y2, x, door_center=None, dw=800, thick=WALL_P, name="P"):
    """Interior partition with an actual doorway cut through the wall."""
    if y2 <= y1:
        return []
    wall = box(name, x, (y1+y2)/2, H_CLR/2, thick, y2-y1, H_CLR, M['beton'])
    if door_center is not None:
        dh = 1970
        boolean_cut(wall, x, door_center, dh/2, thick+100, dw, dh, name+"_DoorVoid")
    return [wall]

# ===================================================================
# ZÁBRADLÍ S PLASTOVÝMI DESKAMI
# ===================================================================
def plast_zabradli(cx, cy, length, facing, name="Zab"):
    objs = []
    if facing == 'Y':
        objs += [box(name+"_TopRail", cx, cy, 1150, length, 100, 80, M['zabr']),
                 box(name+"_MidRail", cx, cy, 750, length, 60, 40, M['zabr']),
                 box(name+"_BotRail", cx, cy, 400, length, 60, 40, M['zabr'])]
        n = max(2, int(length/1200))
        for i in range(n+1):
            px = cx - length/2 + i*length/n
            objs.append(box(name+f"_Post{i}", px, cy, 575, 60, 80, 1150, M['zabr']))
        for i in range(n):
            px = cx - length/2 + (i+0.5)*length/n
            pw = length/n - 80
            objs.append(box(name+f"_Panel{i}", px, cy, 775, pw, 25, 700, M['panel']))
    else:
        objs += [box(name+"_TopRail", cx, cy, 1150, 100, length, 80, M['zabr']),
                 box(name+"_MidRail", cx, cy, 750, 60, length, 40, M['zabr']),
                 box(name+"_BotRail", cx, cy, 400, 60, length, 40, M['zabr'])]
        n = max(2, int(length/1200))
        for i in range(n+1):
            py = cy - length/2 + i*length/n
            objs.append(box(name+f"_Post{i}", cx, py, 575, 80, 60, 1150, M['zabr']))
        for i in range(n):
            py = cy - length/2 + (i+0.5)*length/n
            pw = length/n - 80
            objs.append(box(name+f"_Panel{i}", cx, py, 775, 25, pw, 700, M['panel']))
    return objs

# ===================================================================
# LODŽIE
# ===================================================================
def lodzie_predni(x1, x2, y_facade, y_front):
    objs = []
    objs.append(box("LP_Floor", (x1+x2)/2, (y_facade+y_front)/2, 0,
                    x2-x1, y_front-y_facade, 200, M['beton']))
    for xb in [x1, x2]:
        objs.append(box("LP_Boc", xb, (y_facade+y_front)/2, H_CLR/2,
                        FAC, y_front-y_facade, H_CLR, M['bila']))
    for i in range(2):
        mx = x1 + i*MOD + MOD/2
        objs.extend(plast_zabradli(mx, y_front-50, MOD-200, 'Y', name=f"LPZab{i}"))
    return objs

def lodzie_zadni(x1, x2, y_facade, y_front):
    objs = []
    objs.append(box("LZ_Floor", (x1+x2)/2, (y_facade+y_front)/2, 0,
                    x2-x1, abs(y_front-y_facade), 200, M['beton']))
    y_boc_f = y_front - 300
    for xb in [x1, x2]:
        objs.append(box("LZ_Boc", xb, (y_facade+y_boc_f)/2, H_CLR/2,
                        WALL_B, abs(y_boc_f-y_facade), H_CLR, M['bila']))
    objs.extend(plast_zabradli((x1+x2)/2, y_front-50, x2-x1-200, 'Y', name="LZZab"))
    return objs

# === NOVÉ (F): Štítová lodžie na východním štítu ===
def lodzie_stitni_east(y1, y2, x_facade, name="EGL"):
    """Štítová lodžie - východní štít, mezera 105 mm od fasády"""
    objs = []
    x_back  = x_facade + EGL_GAP             # zadní hrana bočnice
    x_boc_f = x_back + EGL_DEPTH_B           # čelo bočnice
    x_floor = x_facade + EGL_DEPTH_F         # čelo podlahy

    # Podlaha
    objs.append(box(f"{name}_Floor", (x_facade+x_floor)/2, (y1+y2)/2, 0,
                    EGL_DEPTH_F, y2-y1, 200, M['beton']))
    # Bočnice (2× - sdílené mezi kolonami, mírně přesahující)
    for yb in [y1, y2]:
        objs.append(box(f"{name}_Boc_{yb}", (x_back+x_boc_f)/2, yb, H_CLR/2,
                        EGL_DEPTH_B, WALL_B, H_CLR, M['bila']))
    # Zábradlí (plastové desky)
    objs.extend(plast_zabradli(x_floor-50, (y1+y2)/2, y2-y1-200, 'X', name=f"{name}_Zab"))
    return objs

# ===================================================================
# APARTMÁNY (byty)
# ===================================================================
def apt_3plus1(x1, x2, y_front, y_rear, name="A"):
    objs = []
    mid_x = (x1+x2)/2
    y_p1 = y_front - 4000
    y_p2 = y_p1 - 3200
    y_p3 = y_p2 - 2800
    objs.extend(partition_x(x1, x2, y_p1, door_center=mid_x+600, name=name+"_P1"))
    objs.extend(partition_x(x1, x2, y_p2, door_center=mid_x-600, name=name+"_P2"))
    objs.extend(partition_x(x1, x2, y_p3, door_center=mid_x+800, name=name+"_P3"))
    objs.extend(partition_y(y_p2, y_p3, mid_x, door_center=(y_p2+y_p3)/2, name=name+"_PV"))
    jx, jy = x1 + 900, y_rear + 1200
    objs.append(box(name+"_Jadro", jx, jy, H_CLR/2-30, 1600, 2200, H_CLR-60, M['umakart']))
    objs.append(box(name+"_Vana",  jx, jy-400, 300, 1400, 700, 600, M['smalt']))
    objs.append(box(name+"_Umyv",  jx+500, jy+500, 850, 400, 400, 150, M['smalt']))
    objs.append(box(name+"_Lino", mid_x, (y_front+y_rear)/2, 5,
                    x2-x1-20, y_front-y_rear-20, 10, M['lino']))
    return objs

def apt_2kk(x1, x2, y_front, y_rear, name="Y"):
    objs = []
    mid_x = (x1+x2)/2
    y_p = y_front - 6500
    objs.extend(partition_x(x1, x2, y_p, door_center=mid_x, name=name+"_P1"))
    jx, jy = x1 + 800, y_rear + 1200
    objs.append(box(name+"_Jadro", jx, jy, H_CLR/2-30, 1400, 2000, H_CLR-60, M['umakart']))
    objs.append(box(name+"_Vana",  jx, jy-300, 300, 1200, 700, 600, M['smalt']))
    objs.append(box(name+"_Umyv",  jx+400, jy+400, 850, 350, 350, 150, M['smalt']))
    objs.append(box(name+"_Lino", mid_x, (y_front+y_rear)/2, 5,
                    x2-x1-20, y_front-y_rear-20, 10, M['lino']))
    return objs

# ===================================================================
# SCHODIŠTĚ + VÝTAHOVÁ ŠACHTA (procedurální, opakováno v každém podlaží)
# ===================================================================
def beam_between(name, p1, p2, width, height, mat):
    """Create a rectangular beam between two millimetre-space points."""
    a = mathutils.Vector((p1[0], p1[1], p1[2]))
    b = mathutils.Vector((p2[0], p2[1], p2[2]))
    d = b - a
    ob = box(name, *( (a+b)/2 ), d.length, width, height, mat)
    ob.rotation_euler = d.to_track_quat('X', 'Z').to_euler()
    return ob


def build_vertical_core_story():
    """Concrete U-stair, landings and open lift shaft. Doorways stay empty."""
    objs = []
    # The existing north-west projection is 3.6 x 4.8 m and remains the core.
    sx1, sx2 = -11050, -9300
    flight_w = 825
    gap = 100
    x_a = sx1 + flight_w/2
    x_b = sx2 - flight_w/2
    y_start, tread, riser, nsteps = 8100, 280, 200, 7
    y_end = y_start + tread*nsteps
    half_z = nsteps*riser
    # Lower floor landing, repeated with each storey.
    objs.append(box("Stair_Landing_Lower", (sx1+sx2)/2, 7900, 40,
                    sx2-sx1, 400, 80, M['beton']))
    # Flight A: floor to half landing, rising toward +Y.
    for i in range(nsteps):
        h = (i+1)*riser
        yc = y_start + (i+0.5)*tread
        objs.append(box(f"Stair_A_Step_{i+1}", x_a, yc, h/2,
                        flight_w, tread, h, M['beton']))
    # Flight B: half landing to next floor, returning toward -Y.
    for i in range(nsteps):
        h = (i+1)*riser
        yc = y_end - (i+0.5)*tread
        objs.append(box(f"Stair_B_Step_{i+1}", x_b, yc, half_z+h/2,
                        flight_w, tread, h, M['beton']))
    # Intermediate landing at +1.40 m; next floor's lower landing forms the upper arrival.
    objs.append(box("Stair_Landing_Half", (sx1+sx2)/2, y_end+120,
                    half_z-40, sx2-sx1, 240, 80, M['beton']))
    # Practical, continuous steel handrails with a restrained post rhythm.
    rail_offset = flight_w/2 - 70
    for lane, xc in (("A", x_a), ("B", x_b)):
        if lane == "A":
            p_bottom, p_top = (y_start, 950), (y_end, half_z+950)
        else:
            p_bottom, p_top = (y_end, half_z+950), (y_start, 2*half_z+950)
        for side, xx in (("L", xc-rail_offset), ("R", xc+rail_offset)):
            objs.append(beam_between(f"Stair_Rail_{lane}_{side}",
                         (xx, p_bottom[0], p_bottom[1]),
                         (xx, p_top[0], p_top[1]), 45, 45, M['kov_tm']))
            for j in range(4):
                t = (j+0.5)/4
                yy = p_bottom[0] + (p_top[0]-p_bottom[0])*t
                zz = p_bottom[1] + (p_top[1]-p_bottom[1])*t
                objs.append(box(f"Stair_Post_{lane}_{side}_{j}", xx, yy, zz-450,
                                35, 35, 900, M['kov_tm']))
    # Lift shaft, with a 900 x 2300 mm open doorway at every served floor.
    lx1, lx2 = -12600, -11250
    ly1, ly2 = 8100, 10200
    lift_door_x = (lx1+lx2)/2
    objs.extend(wall_x(lx1, lx2, ly1, [(lift_door_x, 900, 'door')], 150, M['beton'], "Lift_South"))
    objs.extend(wall_x(lx1, lx2, ly2, [], 150, M['beton'], "Lift_North"))
    objs.extend(wall_y(ly1, ly2, lx1, [], 150, M['beton'], "Lift_West"))
    objs.extend(wall_y(ly1, ly2, lx2, [], 150, M['beton'], "Lift_East"))
    return objs


def cut_core_openings_from_slab(slab):
    """Open the stair void and continuous lift shaft in each repeated floor plate."""
    if slab is None:
        return
    boolean_cut(slab, -10175, 9150, H_CLR+SLAB/2,
                2050, 3000, SLAB+200, "Slab_Stairwell_Void")
    boolean_cut(slab, -11925, 9150, H_CLR+SLAB/2,
                1550, 2250, SLAB+200, "Slab_LiftShaft_Void")

# ===================================================================
# TYPICKÉ PODLAŽÍ (s východními lodžiemi - F)
# ===================================================================
def build_typical_floor():
    objs = []
    foot = [(VYX1,VYYO),(VYX2,VYYO),(VYX2,Y_N),(X_E,Y_N),(X_E,Y_S),
            (LRX2,Y_S),(LRX2,LRY),(LRX1,LRY),(LRX1,Y_S),(X_W,Y_S)]
    slab = prism("Slab", foot, H_CLR, H_CLR+SLAB, M['beton'])
    cut_core_openings_from_slab(slab)
    objs.append(slab)
    objs.extend(build_vertical_core_story())

    for xb, nm in [(-9200,"GR"),(-5600,"RB"),(-2000,"BY"),(5200,"YBr")]:
        objs.append(box(f"Wall_{nm}", xb, (Y_S+Y_N)/2, H_CLR/2, WALL_B, Y_N-Y_S, H_CLR, M['beton']))

    # FRONT fasáda
    objs.extend(wall_x(X_W, -9200, Y_N, [(X_W+1800, 2400, 'door')], FAC, M['bila'], "F_Gr_CoreEntry"))
    objs.extend(wall_x(-9200, -5600, Y_N, [(-7400, WINW, 'win')], FAC, M['bila'], "F_R"))
    objs.extend(wall_x(-5600, -2000, Y_N, [(-3800, WINW, 'win')], FAC, M['bila'], "F_B"))
    objs.extend(wall_x(5200, X_E, Y_N, [(8800, WINW, 'win')], FAC, M['bila'], "F_Br"))
    objs.extend(wall_x(LFX1, LFX2, Y_N, [
        (LFX1+900, WINW, 'win'), (LFX1+MOD-500, BDW, 'door'),
        (LFX1+MOD+900, WINW, 'win'), (LFX1+2*MOD-500, BDW, 'door'),
    ], FAC, M['bila'], "F_Y"))

    # REAR fasáda
    rear_gaps = []
    for i in range(7):
        mx = X_W + 1800 + i*MOD
        if LRX1-500 <= mx <= LRX2+500: continue
        rear_gaps.append((mx, WINW, 'win'))
    objs.extend(wall_x(X_W, X_E, Y_S, rear_gaps, FAC, M['bila'], "R"))
    objs.extend(wall_x(LRX1, LRX2, Y_S, [(LRX1+1800, BDW, 'door')], FAC, M['bila'], "R_Y"))

    # === VÝCHODNÍ ŠTÍT: 2 štítové lodžie (F) ===
    east_gaps = [
        (-3100, BDW,  'door'),   # BD pro lodžii 1
        (  500, BDW,  'door'),   # BD pro lodžii 2
        ( 3600, WINW, 'win'),
        ( 5800, WINW, 'win'),
    ]
    objs.extend(wall_y(Y_S, Y_N, X_E, east_gaps, FAC, M['bila'], "E"))
    objs.extend(lodzie_stitni_east(EGL1_Y[0], EGL1_Y[1], X_E, name="EGL1"))
    objs.extend(lodzie_stitni_east(EGL2_Y[0], EGL2_Y[1], X_E, name="EGL2"))

    # ZÁPADNÍ ŠTÍT (s výstupkem)
    west_gaps = [(Y_S+3600+i*3600, WINW, 'win') for i in range(2) if Y_S+3600+i*3600 < Y_N-500]
    objs.extend(wall_y(Y_S, Y_N, X_W, west_gaps, FAC, M['bila'], "Ws"))

    # VÝSTUPEK
    objs.extend(wall_x(VYX1, VYX2, VYYO, [(VYX1+1800, WINW, 'win')], FAC, M['bila'], "V_C"))
    objs.extend(wall_y(Y_N, VYYO, VYX1, [(Y_N+2400, WINW, 'win')], FAC, M['bila'], "V_W"))
    objs.extend(wall_y(Y_N, VYYO, VYX2, [(Y_N+2400, WINW, 'win')], FAC, M['bila'], "V_E"))

    # LODŽIE front + rear
    objs.extend(lodzie_predni(LFX1, LFX2, Y_N, LFY))
    objs.extend(lodzie_zadni(LRX1, LRX2, Y_S, LRY))

    # BYTY
    objs.extend(apt_3plus1(X_W+WALL_B/2, -9200-WALL_B/2, Y_N, Y_S, "Gr"))
    objs.extend(apt_3plus1(-9200+WALL_B/2, -5600-WALL_B/2, Y_N, Y_S, "R"))
    objs.extend(apt_3plus1(-5600+WALL_B/2, -2000-WALL_B/2, Y_N, Y_S, "B"))
    objs.extend(apt_2kk(-2000+WALL_B/2, 5200-WALL_B/2, LFY, Y_S, "Y"))
    objs.extend(apt_3plus1(5200+WALL_B/2, X_E-WALL_B/2, Y_N, Y_S, "Br"))

    return objs

# ===================================================================
# (E) DETAILNÍ STŘECHA
# ===================================================================
def build_roof_details():
    objs = []
    AT_H, AT_T = 300, 200

    # === LEVEL 1: hlavní střecha ve z=15*H_STR ===
    z1 = 15 * H_STR
    foot = [(VYX1,VYYO),(VYX2,VYYO),(VYX2,Y_N),(X_E,Y_N),(X_E,Y_S),
            (LRX2,Y_S),(LRX2,LRY),(LRX1,LRY),(LRX1,Y_S),(X_W,Y_S)]

    # Atika
    for i in range(len(foot)):
        v1, v2 = foot[i], foot[(i+1) % len(foot)]
        cx, cy = (v1[0]+v2[0])/2, (v1[1]+v2[1])/2
        dx, dy = v2[0]-v1[0], v2[1]-v1[1]
        L = math.hypot(dx, dy); ang = math.atan2(dy, dx)
        ob = box(f"Atika1_{i}", cx, cy, z1 + AT_H/2, L, AT_T, AT_H, M['bila'])
        ob.rotation_euler = (0, 0, ang)
        objs.append(ob)
        # oplechování atiky
        ob = box(f"Plech1_{i}", cx, cy, z1 + AT_H + 30, L, AT_T+60, 60, M['kov_tm'])
        ob.rotation_euler = (0, 0, ang)
        objs.append(ob)

    # Vzduchotechnika
    vzt_positions = [(-8000,3000,1200,800), (-4000,5000,1000,700),
                     (2000,6000,1200,800), (8000,3000,1000,700),
                     (-6000,-3000,900,700), (4000,-4000,800,600)]
    for i, (vx, vy, sx, sy) in enumerate(vzt_positions):
        objs.append(box(f"VZT_{i}", vx, vy, z1+400, sx, sy, 800, M['beton']))
        objs.append(box(f"VZT_T_{i}", vx, vy, z1+850, sx*0.4, sy*0.4, 100, M['kov_tm']))

    # Komíny
    for i, (kx, ky) in enumerate([(-4000,1000), (0,3000), (4000,1000)]):
        objs.append(cylinder(f"Komin_{i}", kx, ky, z1, 300, 1200, M['bila'], segs=10))

    # Střešní výlez (komínový výstup)
    objs.append(box("Vylet_Box", -10000, 5000, z1+750, 900, 900, 1200, M['bila']))
    objs.append(box("Vylet_St", -10000, 5000, z1+1400, 1000, 1000, 100, M['kov_tm']))
    for i, (lx, ly) in enumerate([(-10400,4600),(-10400,5400),(-9600,4600),(-9600,5400)]):
        objs.append(box(f"Vylet_L{i}", lx, ly, z1+300, 80, 80, 600, M['beton']))

    # Antény (3×)
    for i, (ax, ay) in enumerate([(0,0), (-6000,5000), (6000,-3000)]):
        objs.append(cylinder(f"Ant_{i}", ax, ay, z1, 50, 3000, M['kov'], segs=8))
        objs.append(box(f"AntX_{i}", ax, ay, z1+2500, 800, 20, 20, M['kov']))
        objs.append(box(f"AntY_{i}", ax, ay, z1+2800, 20, 800, 20, M['kov']))

    # Bleskosvod (po obvodu, 50 mm nad atikou)
    for i in range(len(foot)):
        v1, v2 = foot[i], foot[(i+1) % len(foot)]
        cx, cy = (v1[0]+v2[0])/2, (v1[1]+v2[1])/2
        dx, dy = v2[0]-v1[0], v2[1]-v1[1]
        L = math.hypot(dx, dy); ang = math.atan2(dy, dx)
        ob = box(f"Blesk_{i}", cx, cy, z1 + AT_H + 80, L, 15, 15, M['kov'])
        ob.rotation_euler = (0, 0, ang)
        objs.append(ob)

    # Betonové dlaždice proti podfouknutí
    for i, x in enumerate(range(int(X_W+800), int(X_E), 1000)):
        for j, y in enumerate(range(int(Y_S+800), int(Y_N), 1000)):
            # vynechat vnější zónu
            if x < VYX2 and y > Y_N - 200: continue
            if x > 10500 and y < -5500: continue
            objs.append(box(f"Dlaz_{i}_{j}", x, y, z1+230, 800, 800, 60, M['beton']))

    # === LEVEL 2: pseudotrasa ve z=16*H_STR ===
    z2 = 16 * H_STR
    for i in range(4):
        a = i * math.pi/2
        cx, cy = 1000 + 1500*math.cos(a), 1000 + 1500*math.sin(a)
        objs.append(box(f"Atika2_{i}", cx, cy, z2+200, 3000 if i % 2 == 0 else 3000,
                        200, 200, M['bila']))

    # === LEVEL 3: střecha strojovny ve z=17*H_STR ===
    z3 = 17 * H_STR
    stroj_v = [(-3000,-1000),(3000,-1000),(3000,3000),(-3000,3000)]
    for i in range(4):
        v1, v2 = stroj_v[i], stroj_v[(i+1) % 4]
        cx, cy = (v1[0]+v2[0])/2, (v1[1]+v2[1])/2
        dx, dy = v2[0]-v1[0], v2[1]-v1[1]
        L = math.hypot(dx, dy); ang = math.atan2(dy, dx)
        ob = box(f"Atika3_{i}", cx, cy, z3 + AT_H/2, L, AT_T, AT_H, M['bila'])
        ob.rotation_euler = (0, 0, ang)
        objs.append(ob)
        ob = box(f"Plech3_{i}", cx, cy, z3 + AT_H + 30, L, AT_T+60, 60, M['kov_tm'])
        ob.rotation_euler = (0, 0, ang)
        objs.append(ob)

    # Hlavní anténní stožár na strojovně
    objs.append(cylinder("Stozar_Stroj", 0, 1000, z3, 80, 4000, M['kov'], segs=10))
    objs.append(box("Stozar_X1", 0, 1000, z3+3500, 1200, 30, 30, M['kov']))
    objs.append(box("Stozar_X2", 0, 1000, z3+3900, 800, 20, 20, M['kov']))
    objs.append(box("Stozar_Box", 0, 1000, z3+2000, 200, 100, 100, M['kov_tm']))

    return objs

# ===================================================================
# (C) INTERIÉROVÉ OSVĚTLENÍ
# ===================================================================
def add_apartment_lights(z0, x_center, y_center, apt_type="2kk"):
    """Přidá osvětlení do jednoho bytu"""
    lights = []
    def _point(name, x, y, z, energy=60, color=(1.0,0.85,0.65), r=0.15):
        l = bpy.data.lights.new(name, 'POINT')
        l.energy = energy; l.color = color; l.shadow_soft_size = r
        o = bpy.data.objects.new(name, l)
        o.location = (x/1000, y/1000, z/1000)
        bpy.context.scene.collection.objects.link(o)
        lights.append(o)
    def _area(name, x, y, z, sx, sy, energy=80, color=(1.0,0.95,0.85)):
        l = bpy.data.lights.new(name, 'AREA')
        l.energy = energy; l.color = color; l.size = 1.0
        l.shape = 'RECTANGLE'; l.size_y = 0.05
        o = bpy.data.objects.new(name, l)
        o.location = (x/1000, y/1000, z/1000)
        o.scale = (sx/1000, sy/1000, 1.0)
        bpy.context.scene.collection.objects.link(o)
        lights.append(o)

    # 5-ramenný lustr v obýváku
    for i in range(5):
        ang = i * 2*math.pi/5
        lx = x_center + 350*math.cos(ang)
        ly = y_center + 350*math.sin(ang)
        _point(f"L_Ob_{i}", lx, ly, z0+2200, energy=80, color=(1.0,0.80,0.55))
    _point("L_Ob_Center", x_center, y_center, z0+2300, energy=120, color=(1.0,0.85,0.65), r=0.3)

    # Ložnice (menší lustr)
    _point("L_Loz", x_center, y_center+3500, z0+2300, energy=80, color=(1.0,0.85,0.65))

    # Kuchyňský kout - zářivka
    _area("L_Kuch", x_center+1200, y_center-1500, z0+2550, 800, 300, energy=120, color=(0.95,0.95,0.85))

    # Jádro - zářivka v Ergo skříňce
    _point("L_Jadro", x_center-1800, y_center+3500, z0+1800, energy=30, color=(0.9,0.95,1.0), r=0.1)

    # Předsíň
    _area("L_Pred", x_center+3500, y_center+4500, z0+2550, 300, 800, energy=60, color=(0.95,0.92,0.85))

    return lights

# ===================================================================
# SESTAVENÍ
# ===================================================================
print("\n=== VP-OS Building Architecture v4 (BOOLEAN OPENINGS + STAIRS + LIFT) ===\n")

print("1. Typické podlaží (s východními lodžiemi)...")
floor_master = join(build_typical_floor(), "VP-OS_Typ_1")

print("2. Array 15 pater...")
arr = floor_master.modifiers.new("Array15", 'ARRAY')
arr.count = 15
arr.use_relative_offset = False
arr.use_constant_offset = True
arr.constant_offset_displace = (0, 0, H_STR/1000)
bpy.context.view_layer.objects.active = floor_master
bpy.ops.object.modifier_apply(modifier="Array15")

print("2b. Pokračování schodiště a výtahu do střešních úrovní...")
for core_level in (15, 16):
    upper_core_objs = build_vertical_core_story()
    # Keep the projected stair tower enclosed on the two rooftop-access levels.
    upper_core_objs.extend(wall_x(X_W, -9200, Y_N, [(X_W+1800, 2400, 'door')], FAC, M['bila'], f"CoreEntry_{core_level+1}"))
    upper_core_objs.extend(wall_x(VYX1, VYX2, VYYO, [(VYX1+1800, WINW, 'win')], FAC, M['bila'], f"CoreNorth_{core_level+1}"))
    upper_core_objs.extend(wall_y(Y_N, VYYO, VYX1, [(Y_N+2400, WINW, 'win')], FAC, M['bila'], f"CoreWest_{core_level+1}"))
    upper_core_objs.extend(wall_y(Y_N, VYYO, VYX2, [(Y_N+2400, WINW, 'win')], FAC, M['bila'], f"CoreEast_{core_level+1}"))
    core_cont = join(upper_core_objs, f"VP-OS_Core_{core_level+1}")
    if core_cont:
        core_cont.location.z += core_level * H_STR / 1000

# Empty lift shaft with visible guide rails and one open car as a scale cue.
shaft_bottom = 0
shaft_top = 17 * H_STR
for rail_x in (-12480, -11370):
    box("Lift_Guide_Rail", rail_x, 9150, shaft_top/2, 55, 55, shaft_top, M['kov_tm'])
# The cabin is intentionally open-fronted: no door leaf and no glazing.
car_floor_z = 4 * H_STR
car_cx, car_y1, car_y2 = -11925, 8350, 9820
car_w, car_d, car_h, car_t = 1020, car_y2-car_y1, 2050, 40
box("Lift_Car_Floor", car_cx, (car_y1+car_y2)/2, car_floor_z+40,
    car_w, car_d, 80, M['kov_tm'])
box("Lift_Car_West", car_cx-car_w/2+car_t/2, (car_y1+car_y2)/2, car_floor_z+car_h/2,
    car_t, car_d, car_h, M['kov_tm'])
box("Lift_Car_East", car_cx+car_w/2-car_t/2, (car_y1+car_y2)/2, car_floor_z+car_h/2,
    car_t, car_d, car_h, M['kov_tm'])
box("Lift_Car_Back", car_cx, car_y2-car_t/2, car_floor_z+car_h/2,
    car_w, car_t, car_h, M['kov_tm'])

print("3. Podlaží 16 (pseudotrasa)...")
f16_objs = []
for i in range(2):
    lx1 = LFX1 + i*MOD; lx2 = lx1+MOD
    f16_objs.extend(lodzie_predni(lx1, lx2, Y_N, LFY))
f16_objs.append(box("R16", (X_W+X_E)/2, Y_S+1200, H_CLR/2, 8000, FAC, H_CLR, M['bila']))
f16_objs.append(prism("Slab16", [(LFX1-500,Y_N),(LFX2+500,Y_N),
                                  (LFX2+500,LFY),(LFX1-500,LFY)],
                      H_CLR, H_CLR+SLAB, M['beton']))
for xb in [LFX1-100, LFX2+100]:
    f16_objs.append(box("B16", xb, (Y_N+LFY)/2, H_CLR/2, WALL_B, LFY-Y_N, H_CLR, M['bila']))
f16 = join(f16_objs, "VP-OS_16")
if f16: f16.location.z = 15*H_STR/1000

print("4. Podlaží 17 (strojovna)...")
f17_objs = [
    box("Strojovna", 0, 1000, H_CLR/2, 6000, 4000, H_CLR, M['bila']),
    prism("Slab17", [(-3000,-1000),(3000,-1000),(3000,3000),(-3000,3000)],
          H_CLR, H_CLR+SLAB, M['beton']),
]
f17 = join(f17_objs, "VP-OS_17")
if f17: f17.location.z = 16*H_STR/1000

print("5. DETAILNÍ STŘECHA (E)...")
roof_objs = build_roof_details()
join(roof_objs, "VP-OS_Střecha_Detaily")

print("6. Červené pruhy (NP 3, 4, 6)...")
for fl in [3, 4, 6]:
    z = (fl-1)*H_STR + H_CLR/2
    box("R1", -3800, Y_N+FAC/2+20, z, 10800, 40, H_CLR, M['cervena'])
    box("R2", 10600, Y_N+FAC/2+20, z, 3600, 40, H_CLR, M['cervena'])
    box("R3", -200, Y_S-FAC/2-20, z, X_E-X_W, 40, H_CLR, M['cervena'])
    box("R4", X_E+FAC/2+20, (Y_S+Y_N)/2, z, 40, Y_N-Y_S, H_CLR, M['cervena'])
    box("R5", (VYX1+VYX2)/2, VYYO+FAC/2+20, z, VYX2-VYX1, 40, H_CLR, M['cervena'])

print("7. Návěstidla...")
roof_z = 17 * H_STR
for x, y in [(X_W,Y_N),(X_E,Y_N),(X_W,Y_S),(X_E,Y_S)]:
    nav = box("Navěstidlo", x, y, roof_z+600, 300, 300, 300, M['cervena'])
    bsdf = nav.data.materials[0].node_tree.nodes['Principled BSDF']
    bsdf.inputs['Emission Color'].default_value = (1,0,0,1)
    bsdf.inputs['Emission Strength'].default_value = 5.0

print("8. INTERIÉROVÉ OSVĚTLENÍ (C) - 5. patro, byt 2+kk...")
add_apartment_lights(4*H_STR, 1600, 3000, apt_type="2kk")
print("   → 5-ramenný lustr, lustr ložnice, kuch. zářivka, jádro, předsíň")

print("9. Exteriér - Slunce + kamera...")
sun_d = bpy.data.lights.new("Sun", 'SUN'); sun_d.energy = 4.0
sun_d.angle = math.radians(2)
sun = bpy.data.objects.new("Sun", sun_d)
bpy.context.scene.collection.objects.link(sun)
sun.location = (20.0, 30.0, 40.0)
sun.rotation_euler = (math.radians(50), math.radians(15), math.radians(150))

world = bpy.data.worlds.new("Sky"); bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs['Color'].default_value = (0.55, 0.72, 0.95, 1.0)

cam_d = bpy.data.cameras.new("Cam"); cam = bpy.data.objects.new("Cam", cam_d)
bpy.context.scene.collection.objects.link(cam)
cam.location = (42.0, -55.0, 45.0)
d = (-cam.location[0], -cam.location[1], 25.5 - cam.location[2])
cam.rotation_euler = mathutils.Vector(d).to_track_quat('-Z','Y').to_euler()
cam_d.lens = 24
bpy.context.scene.camera = cam

print("10. Render nastavení...")
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = 128
sc.render.resolution_x = 1920
sc.render.resolution_y = 1080
sc.cycles.use_denoising = True

print("\n=== VP-OS BUILDING ARCHITECTURE v4 ===\n"
      "  ✓ Zachován původní objem panelového domu, 15 typických podlaží a střešní nástavby\n"
      "  ✓ Fasádní okna a balkonové dveře jsou průchozí Boolean otvory bez rámů, skla a křídel\n"
      "  ✓ Interiérové dveře jsou prázdné otvory; žádná dveřní křídla se nevytvářejí\n"
      "  ✓ Schodišťové rameno U s mezipodestou, stupni a ocelovým zábradlím\n"
      "  ✓ Výtahová šachta s otvory v každém podlaží, vodítky a otevřenou kabinou v 5. NP\n"
      "  ! Finální .blend a render se uloží do složky vedle tohoto .py souboru\n")

# Uložení samostatného Blender projektu vedle skriptu.
import os
try:
    OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
except NameError:
    OUTPUT_DIR = bpy.path.abspath("//")
if not OUTPUT_DIR:
    OUTPUT_DIR = os.getcwd()
OUTPUT_DIR = os.path.abspath(OUTPUT_DIR)
os.makedirs(os.path.join(OUTPUT_DIR, "renders"), exist_ok=True)
sc.render.filepath = os.path.join(OUTPUT_DIR, "renders", "VP_OS_Building_Architecture_v4.png")
blend_path = os.path.join(OUTPUT_DIR, "VP_OS_Building_Architecture_v4.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print("Saved Blender project:", blend_path)
