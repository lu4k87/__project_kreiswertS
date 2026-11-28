# Renders the example pictures of material forms, categories and industries in Blender (decision of 2026-11-28:
# own renders instead of stock photos, so no licence conditions apply). One studio scene, one function per motif.
#   /Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python scripts/images/render.py -- public/images/renders [motif ...]
# Writes <out_dir>/<file>.jpg (800 × 600, the keys of src/components/ui/material-photo.tsx); all motifs ≈ 6 min on an M4 Pro.
import bpy, bmesh, math, random, sys, os
from mathutils import Euler, Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(ARGS[0] if ARGS else "renders")
HDRI = os.path.join(os.path.dirname(bpy.app.binary_path), "..", "Resources", f"{bpy.app.version[0]}.{bpy.app.version[1]}", "datafiles", "studiolights", "world")

# ---------- scene, light, camera ----------
def reset(seed):
    random.seed(seed)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("METAL", "OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind; prefs.get_devices()
            for d in prefs.devices: d.use = True
            s.cycles.device = "GPU"; break
        except TypeError:
            continue
    s.cycles.samples = 128; s.cycles.use_denoising = True; s.cycles.max_bounces = 8; s.cycles.transmission_bounces = 10
    s.render.resolution_x, s.render.resolution_y = 800, 600
    s.view_settings.view_transform = "AgX"
    try: s.view_settings.look = "AgX - Medium High Contrast"
    except TypeError: pass
    s.view_settings.exposure = -0.35
    w = bpy.data.worlds.new("w"); s.world = w; w.use_nodes = True
    nt = w.node_tree; env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(HDRI, "studio.exr"))
    bg = nt.nodes["Background"]; bg.inputs["Strength"].default_value = 0.3
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    return s

def mat(name, color, rough=0.45, metal=0.0, trans=0.0, ior=1.45, sss=0.0, coat=0.0, noise=0.0, bump=0.0, scale=40):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal; b.inputs["Transmission Weight"].default_value = trans; b.inputs["IOR"].default_value = ior
    b.inputs["Subsurface Weight"].default_value = sss; b.inputs["Coat Weight"].default_value = coat
    if noise or bump:
        tex = nt.nodes.new("ShaderNodeTexNoise"); tex.inputs["Scale"].default_value = scale; tex.inputs["Detail"].default_value = 8
        if noise:
            mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
            mix.inputs["A"].default_value = (*color, 1); mix.inputs["B"].default_value = (*[c * 0.55 for c in color], 1)
            nt.links.new(tex.outputs["Fac"], mix.inputs["Factor"]); nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
        if bump:
            bn = nt.nodes.new("ShaderNodeBump"); bn.inputs["Strength"].default_value = bump
            nt.links.new(tex.outputs["Fac"], bn.inputs["Height"]); nt.links.new(bn.outputs["Normal"], b.inputs["Normal"])
    return m

def wave_mat(name, color, rough=0.75, scale=3, distortion=8, dark=0.7, kind="BANDS", bump=0.3):
    """Wood grain, corrugated board, fabric weave: wave texture drives colour and bump."""
    m = mat(name, color, rough=rough); nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = kind; wv.inputs["Scale"].default_value = scale
    wv.inputs["Distortion"].default_value = distortion; wv.inputs["Detail"].default_value = 4
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (*color, 1); mix.inputs["B"].default_value = (*[c * dark for c in color], 1)
    nt.links.new(wv.outputs["Fac"], mix.inputs["Factor"]); nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    bn = nt.nodes.new("ShaderNodeBump"); bn.inputs["Strength"].default_value = bump
    nt.links.new(wv.outputs["Fac"], bn.inputs["Height"]); nt.links.new(bn.outputs["Normal"], b.inputs["Normal"])
    return m

def studio(target=(0, 0, 0.5), dist=9.0, elev=32, azim=-28, lens=70, fstop=3.2, floor=(0.62, 0.6, 0.56), key=1400, world=None):
    bpy.ops.mesh.primitive_plane_add(size=300, location=(0, 0, 0))
    bpy.context.object.data.materials.append(mat("floor", floor, rough=0.8, noise=0.15, bump=0.04, scale=6))
    if world is not None: bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = world
    t = Vector(target); e, a = math.radians(elev), math.radians(azim)
    loc = t + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); bpy.context.scene.collection.objects.link(cam)
    cam.location = loc; cam.rotation_euler = (t - loc).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = lens; cam.data.dof.use_dof = fstop > 0; cam.data.dof.focus_distance = (t - loc).length; cam.data.dof.aperture_fstop = max(fstop, 0.1)
    bpy.context.scene.camera = cam
    for name, pos, power, size in (("key", (-7, -4, 9), key, 3.5), ("fill", (8, -5, 4), key * 0.18, 9), ("rim", (3, 9, 6), key * 0.7, 4)):
        l = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA")); bpy.context.scene.collection.objects.link(l)
        l.data.energy = power; l.data.size = size; l.location = Vector(pos) + Vector((target[0], target[1], 0))
        l.rotation_euler = (Vector(target) - l.location).to_track_quat("-Z", "Y").to_euler()

def link(obj): bpy.context.scene.collection.objects.link(obj); return obj

def mesh_obj(name, bm, material=None, smooth=False, bevel=0.0, segs=2):
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segs, affect="EDGES", profile=0.5, clamp_overlap=True)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    if material: o.data.materials.append(material)
    return o

def cylinder(name, r, h, seg=16, bevel=0.0, material=None, smooth=True, r2=None):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    return mesh_obj(name, bm, material, smooth, bevel)

def box(name, sx, sy, sz, bevel=0.0, material=None, segs=2):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    return mesh_obj(name, bm, material, False, bevel, segs)

def tray(name, sx, sy, sz, wall, material=None, bevel=0.01):
    """Open box (crate, tray, housing): five walls of thickness wall."""
    bm = bmesh.new()
    for (cx, cy, cz, dx, dy, dz) in ((0, 0, wall / 2, sx, sy, wall), (0, sy / 2 - wall / 2, sz / 2, sx, wall, sz), (0, -sy / 2 + wall / 2, sz / 2, sx, wall, sz),
                                     (sx / 2 - wall / 2, 0, sz / 2, wall, sy, sz), (-sx / 2 + wall / 2, 0, sz / 2, wall, sy, sz)):
        r = bmesh.ops.create_cube(bm, size=1); vs = r["verts"]
        bmesh.ops.scale(bm, vec=(dx, dy, dz), verts=vs); bmesh.ops.translate(bm, vec=(cx, cy, cz), verts=vs)
    return mesh_obj(name, bm, material, False, bevel)

def shard(name, r, thick, material=None, sides=None, bend=0.0, bevel=0.3):
    sides = sides or random.randint(4, 7); bm = bmesh.new()
    pts = sorted(random.uniform(0, 2 * math.pi) for _ in range(sides))
    vs = [bm.verts.new((math.cos(t) * r * random.uniform(0.55, 1.1), math.sin(t) * r * random.uniform(0.55, 1.1), 0)) for t in pts]
    f = bm.faces.new(vs); ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=(0, 0, thick), verts=[v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)])
    if bend:
        for v in bm.verts: v.co.z += bend * (v.co.x ** 2) / max(r, 1e-3)
    return mesh_obj(name, bm, material, False, thick * bevel)

def rock(name, r, material=None, flat=1.0):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
    for v in bm.verts: v.co *= random.uniform(0.75, 1.15); v.co.z *= flat
    bmesh.ops.scale(bm, vec=(random.uniform(0.8, 1.3), random.uniform(0.8, 1.2), random.uniform(0.6, 1.0)), verts=bm.verts)
    return mesh_obj(name, bm, material, True)

def heap(make, n, radius, height, sigma=None, jitter=0.3, tilt=None, center=(0, 0)):
    """Scatter n objects on a mound, denser and higher in the middle; tilt (deg) keeps flat parts lying flat."""
    sigma = sigma or radius * 0.45
    for i in range(n):
        while True:
            x, y = random.gauss(0, sigma), random.gauss(0, sigma)
            if x * x + y * y < radius * radius: break
        top = height * math.exp(-(x * x + y * y) / (2 * sigma * sigma))
        z = max(0.0, top - random.random() ** 2 * top * jitter)
        o = link(make(i)); o.location = (x + center[0], y + center[1], z)
        if tilt is None:
            o.rotation_euler = Euler([random.uniform(0, 2 * math.pi) for _ in range(3)])
        else:
            # lie roughly along the mound surface: slope plus random tilt
            slope = math.atan2(height * (x * x + y * y) ** 0.5 / sigma ** 2 * math.exp(-(x * x + y * y) / (2 * sigma * sigma)), 1)
            o.rotation_euler = Euler((random.uniform(-1, 1) * math.radians(tilt) + slope * 0.6, random.uniform(-1, 1) * math.radians(tilt), random.uniform(0, 2 * math.pi)))
            o.rotation_euler.rotate_axis("Z", 0)

def place(o, loc, rot=(0, 0, 0)):
    link(o); o.location = loc; o.rotation_euler = rot; return o

def group(parts, loc, rz=0.0):
    """Move a list of objects (built around the origin) to loc and turn them by rz."""
    for p in parts:
        p.location.rotate(Euler((0, 0, rz))); p.rotation_euler.z += rz; p.location += Vector(loc)

def pick(seq): return random.choice(seq)

# ---------- motifs: plastics ----------
def granulate():
    reset(1); studio(target=(0, 0.3, 0.55), dist=8.0, elev=33, lens=85, fstop=2.2)
    mats = [mat("p1", (0.012, 0.13, 0.42), rough=0.28, sss=0.25, coat=0.4), mat("p2", (0.016, 0.16, 0.48), rough=0.32, sss=0.25, coat=0.4)]
    base = [cylinder(f"pel{k}", 0.07, 0.1, seg=18, bevel=0.012, material=mats[k % 2]) for k in range(2)]
    heap(lambda i: base[i % 2].copy(), 7000, 3.4, 1.35, jitter=0.15)

def regrind():
    reset(2); studio(target=(0, 0.3, 0.45), dist=8.0, elev=36, lens=85, fstop=2.4)
    cols = [(0.82, 0.82, 0.8), (0.75, 0.78, 0.8), (0.1, 0.28, 0.55), (0.25, 0.5, 0.72), (0.55, 0.6, 0.62), (0.12, 0.35, 0.22)]
    mats = [mat(f"f{i}", c, rough=0.5, sss=0.3, noise=0.1) for i, c in enumerate(cols)]
    weights = [0, 0, 0, 1, 1, 2, 3, 4, 5]
    heap(lambda i: shard(f"fl{i}", random.uniform(0.07, 0.16), 0.02, mats[pick(weights)], bend=random.uniform(-0.12, 0.12)), 5200, 3.4, 1.2, jitter=0.15, tilt=35)

def pet():
    """Recycled PET flakes, close-up for the brand card (start page, login, register): 1216 × 656."""
    s = reset(16); s.render.resolution_x, s.render.resolution_y = 1216, 656
    studio(target=(0, 0.2, 0.75), dist=5.2, elev=38, lens=85, fstop=1.8, floor=(0.5, 0.55, 0.52))
    cols = [(0.82, 0.93, 0.9), (0.7, 0.88, 0.82), (0.9, 0.95, 0.96), (0.55, 0.8, 0.72)]
    mats = [mat(f"pet{i}", c, rough=0.12, trans=0.85, ior=1.57) for i, c in enumerate(cols)]
    heap(lambda i: shard(f"pf{i}", random.uniform(0.08, 0.15), 0.018, mats[i % len(mats)], bend=random.uniform(-0.25, 0.25), bevel=0.25), 4200, 3.2, 1.4, jitter=0.15, tilt=45)

def sheet():
    reset(4); studio(target=(0.2, -0.3, 0.3), dist=10.5, elev=20, azim=-38, lens=70, fstop=4)
    ms = [mat("pvc", (0.86, 0.86, 0.84), rough=0.35), mat("grey", (0.45, 0.47, 0.5), rough=0.4),
          mat("pc", (0.75, 0.88, 0.95), rough=0.06, trans=0.95, ior=1.58), mat("blk", (0.04, 0.04, 0.045), rough=0.45), mat("blue", (0.12, 0.3, 0.55), rough=0.3)]
    z = 0
    for k, m in enumerate([1, 0, 3, 0, 4, 2, 0, 1, 2, 0, 4, 0, 3, 2, 0]):
        t = 0.06 if m != 2 else 0.08; b = place(box(f"s{k}", 3.6, 2.4, t, 0.008, ms[m]), (random.uniform(-0.08, 0.08), random.uniform(-0.08, 0.08), z + t / 2), (0, 0, math.radians(random.uniform(-3, 3))))
        z += t
    for k in range(4):
        w = random.uniform(0.25, 0.6)
        place(box(f"o{k}", 2.2, w, 0.06, 0.006, ms[pick([0, 1, 2])]), (random.uniform(-1, 1.5), -2.1 - k * 0.15, 0.03 + k * 0.061), (0, 0, math.radians(random.uniform(-25, 25))))

def film():
    reset(5); studio(target=(0, 0, 0.7), dist=8.5, elev=26, azim=-30, lens=70, fstop=3.2)
    fm = mat("film", (0.9, 0.95, 0.97), rough=0.12, trans=0.85, ior=1.5)
    core = mat("core", (0.5, 0.36, 0.22), rough=0.8, noise=0.2, bump=0.1)
    dark = mat("in", (0.08, 0.06, 0.04), rough=0.9)
    for (x, y, rz, r) in ((0, 0, 0.15, 0.85), (-1.4, 2.2, -0.35, 0.8)):
        place(cylinder("roll", r, 3.2, seg=64, bevel=0.03, material=fm), (x, y, r), (0, math.pi / 2, rz))
        place(cylinder("core", 0.28, 3.32, seg=40, material=core), (x, y, r), (0, math.pi / 2, rz))
        for sgn in (-1, 1):
            d = Vector((math.cos(rz), math.sin(rz), 0)) * 1.665 * sgn
            place(cylinder("hole", 0.2, 0.02, seg=32, material=dark), (x + d.x, y + d.y, r), (0, math.pi / 2, rz))
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=60, y_segments=40, size=1.6)
    for v in bm.verts:
        v.co.y = (v.co.y + 1.6) * 0.95; v.co.z = 0.012 + 0.05 * math.sin(v.co.x * 6 + v.co.y * 2) * min(1, v.co.y)
    o = mesh_obj("tail", bm, fm, True); place(o, (0.35, -0.75, 0), (0, 0, 0.15 + math.pi))
    o.modifiers.new("sol", "SOLIDIFY").thickness = 0.004

def component():
    reset(6); studio(target=(0, 0, 0.45), dist=8.5, elev=40, azim=-25, lens=70, fstop=3.2)
    crate = mat("crate", (0.08, 0.2, 0.38), rough=0.55, bump=0.05)
    abs_d = mat("abs", (0.05, 0.05, 0.055), rough=0.38, coat=0.2); abs_l = mat("absl", (0.62, 0.63, 0.62), rough=0.4)
    place(tray("crate", 4.0, 3.0, 0.9, 0.06, crate, 0.02), (0, 0, 0))
    housing = [tray(f"h{k}", 0.85, 0.62, 0.32, 0.035, m, 0.012) for k, m in enumerate((abs_d, abs_l))]
    for i in range(4):
        for j in range(4):
            o = housing[(i + j) % 2].copy(); place(o, (-1.42 + i * 0.95 + random.uniform(-0.03, 0.03), -1.05 + j * 0.7, 0.07 + random.uniform(0, 0.02)), (0, 0, math.radians(random.uniform(-4, 4))))
            o.scale = (1, 1, 1)
    for i in range(3):
        o = housing[i % 2].copy(); place(o, (2.6 + i * 0.2, -1.2 + i * 0.75, 0.0 if i != 1 else 0.33), (math.pi if i == 1 else 0, 0, math.radians(random.uniform(-40, 40))))
    cap = cylinder("cap", 0.14, 0.09, seg=28, bevel=0.01, material=abs_l)
    for i in range(10):
        place(cap.copy(), (random.uniform(2.2, 3.4), random.uniform(-2.2, -1.4), 0.045), (0, 0, 0))

def mixed():
    reset(7); studio(target=(0, 0.3, 0.5), dist=8.0, elev=34, lens=85, fstop=2.4)
    cols = [(0.8, 0.8, 0.78), (0.1, 0.28, 0.6), (0.6, 0.08, 0.06), (0.04, 0.04, 0.04), (0.12, 0.42, 0.2), (0.85, 0.65, 0.12), (0.5, 0.55, 0.6)]
    mats = [mat(f"m{i}", c, rough=0.45, sss=0.15) for i, c in enumerate(cols)]
    film_m = mat("film", (0.9, 0.93, 0.95), rough=0.2, trans=0.7)
    caps = [cylinder(f"c{i}", 0.13, 0.1, seg=24, bevel=0.012, material=mats[i]) for i in range(len(cols))]
    pel = [cylinder(f"p{i}", 0.06, 0.09, seg=14, bevel=0.01, material=mats[i]) for i in range(len(cols))]
    def make(i):
        r = random.random()
        if r < 0.45: return shard(f"s{i}", random.uniform(0.1, 0.24), 0.025, pick(mats), bend=random.uniform(-0.2, 0.2))
        if r < 0.6: return shard(f"f{i}", random.uniform(0.25, 0.45), 0.006, film_m, bend=random.uniform(-0.4, 0.4))
        if r < 0.75: return pick(caps).copy()
        return pick(pel).copy()
    heap(make, 3600, 3.4, 1.3, jitter=0.2, tilt=50)

def bottle(name, material):
    bm = bmesh.new()
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.17, radius2=0.17, depth=0.55); bmesh.ops.translate(bm, vec=(0, 0, 0.275), verts=r["verts"])
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.17, radius2=0.06, depth=0.18); bmesh.ops.translate(bm, vec=(0, 0, 0.64), verts=r["verts"])
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.055, radius2=0.055, depth=0.09); bmesh.ops.translate(bm, vec=(0, 0, 0.77), verts=r["verts"])
    for v in bm.verts:
        v.co.x *= random.uniform(0.9, 1.25); v.co.y *= random.uniform(0.2, 0.35); v.co.z -= 0.4
        v.co.x += 0.06 * math.sin(v.co.z * 7 + random.random())
    bmesh.ops.scale(bm, vec=(0.6, 0.6, 0.6), verts=bm.verts)
    return mesh_obj(name, bm, material, True)

def bale(cx, cy, rz, mats, wire, core):
    sx, sy, sz = 2.2, 1.5, 1.5; parts = [box("core", sx - 0.08, sy - 0.08, sz - 0.08, 0, core)]
    parts[0].location = (0, 0, sz / 2)
    bottles = [bottle(f"b{k}", mats[k % len(mats)]) for k in range(10)]
    faces = [((1, 0, 0), sy, sz), ((-1, 0, 0), sy, sz), ((0, 1, 0), sx, sz), ((0, -1, 0), sx, sz), ((0, 0, 1), sx, sy)]
    for (n, a, b) in faces:
        nv = Vector(n)
        for _ in range(int(a * b * 75)):
            u, v = random.uniform(-a / 2 + 0.08, a / 2 - 0.08), random.uniform(-b / 2 + 0.08, b / 2 - 0.08)
            if n[0]: p = Vector((n[0] * (sx / 2 - 0.04), u, v + sz / 2))
            elif n[1]: p = Vector((u, n[1] * (sy / 2 - 0.04), v + sz / 2))
            else: p = Vector((u, v, sz - 0.04))
            # bottle length (local Z) along a random direction in the face, flat side (local Y) along the normal
            ref = Vector((0, 0, 1)) if not n[2] else Vector((1, 0, 0))
            t = ref.cross(nv).normalized(); t2 = nv.cross(t)
            ang = random.uniform(0, 2 * math.pi); zt = (t * math.cos(ang) + t2 * math.sin(ang)).normalized()
            yt = (nv + Vector([random.uniform(-0.25, 0.25) for _ in range(3)])).normalized(); xt = yt.cross(zt).normalized(); yt = zt.cross(xt)
            o = pick(bottles).copy(); o.matrix_world = Matrix.Translation(p) @ Matrix((xt, yt, zt)).transposed().to_4x4(); parts.append(o)
    for xx in (-0.7, 0, 0.7):
        for (dx, dy, dz, lx, ly, lz) in ((0, sy / 2 + 0.06, sz / 2, 0.025, 0.025, sz + 0.12), (0, -sy / 2 - 0.06, sz / 2, 0.025, 0.025, sz + 0.12),
                                         (0, 0, sz + 0.06, 0.025, sy + 0.12, 0.025)):
            w = box("wire", lx, ly, lz, 0, wire); w.location = (xx + dx, dy, dz); parts.append(w)
    for o in parts: link(o)
    bpy.context.view_layer.update()
    rot = Matrix.Translation((cx, cy, 0)) @ Matrix.Rotation(rz, 4, "Z")
    for o in parts: o.matrix_world = rot @ o.matrix_world

def bales():
    reset(8); studio(target=(0.5, 0.6, 0.8), dist=8.6, elev=20, azim=-32, lens=60, fstop=4)
    mats = [mat("clear", (0.75, 0.88, 0.95), rough=0.15, trans=0.6), mat("blue", (0.25, 0.5, 0.8), rough=0.2, trans=0.4),
            mat("green", (0.2, 0.55, 0.3), rough=0.2, trans=0.4), mat("white", (0.85, 0.86, 0.86), rough=0.4), mat("label", (0.7, 0.12, 0.1), rough=0.5)]
    wire = mat("wire", (0.6, 0.6, 0.62), rough=0.3, metal=1); core = mat("core", (0.3, 0.42, 0.5), rough=0.5, noise=0.6, scale=12)
    bale(-0.4, 0, math.radians(8), mats, wire, core); bale(1.9, 1.9, math.radians(-6), mats, wire, core)

# ---------- motifs: categories ----------
def metals():
    reset(9); studio(target=(0, 0.3, 0.5), dist=8.5, elev=32, lens=80, fstop=2.8)
    steel = mat("steel", (0.55, 0.56, 0.58), rough=0.35, metal=1, noise=0.25, bump=0.05)
    rust = mat("rust", (0.38, 0.17, 0.07), rough=0.8, metal=0.3, noise=0.4, bump=0.2)
    alu = mat("alu", (0.8, 0.81, 0.83), rough=0.25, metal=1)
    copper = mat("cu", (0.85, 0.45, 0.25), rough=0.25, metal=1)
    nut = cylinder("nut", 0.11, 0.08, seg=6, bevel=0.008, material=steel, smooth=False)
    def make(i):
        r = random.random()
        if r < 0.3: return cylinder(f"rod{i}", random.uniform(0.025, 0.05), random.uniform(0.6, 1.5), seg=12, material=pick([steel, rust, steel]))
        if r < 0.45: return cylinder(f"pipe{i}", 0.06, random.uniform(0.5, 1.0), seg=20, material=copper)
        if r < 0.75: return shard(f"pl{i}", random.uniform(0.2, 0.45), 0.02, pick([steel, rust, alu]), bend=random.uniform(-0.5, 0.5), bevel=0.2)
        if r < 0.85: return box(f"ang{i}", random.uniform(0.6, 1.1), 0.12, 0.012, 0.004, alu)
        return nut.copy()
    heap(make, 1700, 3.4, 1.25, jitter=0.25)

def wood():
    reset(3); studio(target=(0.9, 0.5, 0.9), dist=7.6, elev=20, azim=-35, lens=60, fstop=4)
    ms = [wave_mat("w1", (0.62, 0.43, 0.25)), wave_mat("w2", (0.55, 0.38, 0.22)), wave_mat("w3", (0.7, 0.52, 0.32)), wave_mat("w4", (0.48, 0.34, 0.2), dark=0.6)]
    for k in range(6): pallet((random.uniform(-0.05, 0.05), random.uniform(-0.05, 0.05), k * 0.315), math.radians(random.uniform(-3, 3)), ms)
    for k in range(3): pallet((2.6, 1.6, k * 0.315), math.radians(82 + random.uniform(-3, 3)), ms)

def pallet(loc, rz, ms, scale=1.0):
    parts = []
    for yy in (-0.6, 0, 0.6):
        for xx in (-0.95, 0, 0.95):
            b = box("blk", 0.22, 0.25, 0.16, 0.01, pick(ms)); b.location = (xx, yy, 0.12); parts.append(b)
        b = box("str", 2.1, 0.25, 0.04, 0.005, pick(ms)); b.location = (0, yy, 0.02); parts.append(b)
    for xx in (-0.95, 0, 0.95):
        b = box("cross", 0.25, 1.45, 0.04, 0.005, pick(ms)); b.location = (xx, 0, 0.22); parts.append(b)
    for k in range(7):
        b = box("top", 0.24 if k in (0, 3, 6) else 0.17, 1.45, 0.035, 0.004, pick(ms)); b.location = (-0.97 + k * 0.323, 0, 0.258); parts.append(b)
    for p in parts:
        p.location *= scale; p.scale = (scale, scale, scale); link(p)
    group(parts, loc, rz); return parts

def paper():
    reset(10); studio(target=(0.7, 0, 0.75), dist=7.4, elev=24, azim=-32, lens=60, fstop=4)
    kraft = [wave_mat(f"k{i}", c, rough=0.85, scale=60, distortion=0, dark=0.85, bump=0.15) for i, c in enumerate(((0.55, 0.37, 0.2), (0.6, 0.42, 0.24), (0.5, 0.34, 0.19)))]
    strap = mat("strap", (0.85, 0.85, 0.82), rough=0.5); tape = mat("tape", (0.62, 0.45, 0.25), rough=0.25)
    z = 0
    for k in range(34):
        t = 0.045; place(box(f"b{k}", 2.4, 1.7, t, 0.006, pick(kraft)), (random.uniform(-0.06, 0.06), random.uniform(-0.06, 0.06), z + t / 2), (0, 0, math.radians(random.uniform(-2.5, 2.5)))); z += t
    for xx in (-0.7, 0.7):
        place(box("s1", 0.06, 1.74, 0.012, 0, strap), (xx, 0, z + 0.006)); place(box("s2", 0.06, 0.012, z, 0, strap), (xx, 0.87, z / 2)); place(box("s3", 0.06, 0.012, z, 0, strap), (xx, -0.87, z / 2))
    for i, (x, y, s) in enumerate(((2.5, 0.6, 0.9), (2.3, -0.8, 0.7), (2.45, -0.75, 0.55))):
        zz = 0 if i < 2 else 0.7
        place(box(f"c{i}", s * 1.2, s, s, 0.01, pick(kraft)), (x, y, zz + s / 2), (0, 0, math.radians(random.uniform(-15, 15))))
        place(box(f"t{i}", s * 0.18, s + 0.004, s * 1.002, 0, tape), (x, y, zz + s / 2), (0, 0, 0))

def glass():
    reset(11); studio(target=(0, 0.3, 0.45), dist=8.0, elev=36, lens=85, fstop=2.6, floor=(0.5, 0.49, 0.46))
    mats = [mat("g1", (0.35, 0.65, 0.4), rough=0.04, trans=1, ior=1.52), mat("g2", (0.55, 0.32, 0.12), rough=0.04, trans=1, ior=1.52),
            mat("g3", (0.92, 0.96, 0.95), rough=0.03, trans=1, ior=1.52)]
    heap(lambda i: shard(f"g{i}", random.uniform(0.08, 0.2), 0.035, mats[pick([0, 0, 1, 2, 2])], bend=random.uniform(-0.25, 0.25), bevel=0.15), 2400, 3.3, 1.15, jitter=0.15, tilt=60)

def textiles():
    reset(12); studio(target=(0.2, 0.1, 0.5), dist=6.2, elev=26, azim=-30, lens=65, fstop=2.8)
    cols = [(0.06, 0.12, 0.26), (0.3, 0.32, 0.35), (0.5, 0.45, 0.35), (0.03, 0.03, 0.035), (0.72, 0.7, 0.66), (0.35, 0.1, 0.1), (0.2, 0.3, 0.22)]
    ms = [wave_mat(f"t{i}", c, rough=0.98, scale=420, distortion=0.4, dark=0.72, kind="RINGS", bump=0.35) for i, c in enumerate(cols)]
    for (x, y, n, rz) in ((-0.75, 0, 12, 4), (0.75, 0.15, 10, -6), (2.1, 0.9, 7, 12)):
        z = 0
        for k in range(n):
            t = random.uniform(0.05, 0.075)
            o = place(box("f", 1.2, 0.8, t, t * 0.48, pick(ms), segs=5), (x + random.uniform(-0.05, 0.05), y + random.uniform(-0.04, 0.04), z + t / 2), (0, 0, math.radians(rz + random.uniform(-5, 5))))
            o.scale = (random.uniform(0.95, 1.05), random.uniform(0.95, 1.05), 1); z += t * 0.96

def minerals():
    reset(13); studio(target=(0, 0.3, 0.5), dist=8.5, elev=32, lens=80, fstop=2.8)
    cols = [(0.34, 0.33, 0.31), (0.24, 0.24, 0.24), (0.42, 0.38, 0.32), (0.3, 0.27, 0.23), (0.45, 0.18, 0.1)]
    ms = [mat(f"r{i}", c, rough=0.92, noise=0.5, bump=0.4, scale=18) for i, c in enumerate(cols)]
    base = [rock(f"rk{k}", 0.14, ms[k % 4]) for k in range(12)]
    def make(i):
        if random.random() < 0.06: return box(f"br{i}", random.uniform(0.18, 0.32), 0.12, 0.08, 0.02, ms[4])
        o = pick(base).copy(); s = random.uniform(0.5, 1.4); o.scale = (s, s, s); return o
    heap(make, 3000, 3.4, 1.3, jitter=0.15)

def surplus():
    reset(14); studio(target=(0.9, 0.3, 0.85), dist=8.0, elev=20, azim=-32, lens=55, fstop=4)
    wood_m = [wave_mat("w1", (0.62, 0.45, 0.27)), wave_mat("w2", (0.56, 0.4, 0.24))]
    kraft = [mat(f"k{i}", c, rough=0.8, noise=0.15, bump=0.05) for i, c in enumerate(((0.58, 0.4, 0.22), (0.62, 0.44, 0.25)))]
    tape = mat("tape", (0.7, 0.55, 0.3), rough=0.25); label = mat("label", (0.93, 0.93, 0.9), rough=0.6)
    crate_m = mat("crate", (0.12, 0.3, 0.5), rough=0.5); crate_g = mat("crateg", (0.35, 0.38, 0.4), rough=0.5)
    pallet((0, 0, 0), math.radians(-4), wood_m)
    for lz in range(3):
        for ix in range(3):
            for iy in range(2):
                x, y, z = -0.7 + ix * 0.7, -0.36 + iy * 0.72, 0.28 + lz * 0.5 + 0.25
                parts = [box("bx", 0.68, 0.7, 0.48, 0.01, pick(kraft)), box("tp", 0.12, 0.702, 0.482, 0, tape), box("lb", 0.3, 0.2, 0.005, 0, label)]
                parts[2].location = (0.12, -0.1, 0.24)
                for p in parts: link(p)
                group(parts, (x, y, z), math.radians(-4))
    for k in range(4):
        o = place(tray("cr", 1.2, 0.8, 0.42, 0.04, crate_m if k % 2 == 0 else crate_g, 0.015), (2.4, 1.2 if k < 3 else -0.2, (k if k < 3 else 0) * 0.42), (0, 0, math.radians(84 + random.uniform(-3, 3))))

def board(ms, loc, rot):
    mask, chip, gold, cap1, cap2, silver = ms; parts = []
    b = box("pcb", 1.4, 0.95, 0.03, 0.004, mask); parts.append(b)
    for _ in range(random.randint(3, 6)):
        s = random.uniform(0.12, 0.3); c = box("chip", s, s * random.uniform(0.6, 1), 0.04, 0.004, chip); c.location = (random.uniform(-0.5, 0.5), random.uniform(-0.3, 0.3), 0.035); parts.append(c)
    for _ in range(random.randint(4, 9)):
        c = cylinder("cap", 0.035, 0.12, seg=16, material=pick([cap1, cap2])); c.location = (random.uniform(-0.6, 0.6), random.uniform(-0.38, 0.38), 0.075); parts.append(c)
    for k in range(14):
        g = box("pad", 0.045, 0.1, 0.004, 0, gold); g.location = (-0.42 + k * 0.065, -0.44, 0.017); parts.append(g)
    s = box("conn", 0.3, 0.15, 0.12, 0.005, silver); s.location = (0.5, 0.3, 0.075); parts.append(s)
    empty = bpy.data.objects.new("e", None); link(empty); empty.location = loc; empty.rotation_euler = rot
    for p in parts: link(p); p.parent = empty

def electronics():
    reset(15); studio(target=(0, 0.2, 0.35), dist=7.5, elev=40, lens=75, fstop=2.8)
    ms = (mat("mask", (0.03, 0.28, 0.12), rough=0.3, coat=0.6, noise=0.2), mat("chip", (0.03, 0.03, 0.035), rough=0.45), mat("gold", (0.9, 0.7, 0.3), rough=0.2, metal=1),
          mat("c1", (0.08, 0.15, 0.4), rough=0.3), mat("c2", (0.04, 0.04, 0.04), rough=0.3), mat("ag", (0.75, 0.75, 0.77), rough=0.3, metal=1))
    blue = mat("mask2", (0.04, 0.12, 0.32), rough=0.3, coat=0.6)
    for k in range(22):
        r = 1.7 * random.random() ** 0.6; a = random.uniform(0, 2 * math.pi)
        x, y = r * math.cos(a), r * math.sin(a); z = 0.05 + 0.06 * k * (1 - r / 2.2)
        m = ms if k % 5 else (blue,) + ms[1:]
        board(m, (x, y, z), (math.radians(random.uniform(-12, 12)), math.radians(random.uniform(-12, 12)), random.uniform(0, 2 * math.pi)))

# ---------- dioramas: industries ----------
CLAY = None
def diorama_base(seed, elev=34, azim=-32, dist=15, lens=50):
    reset(seed); studio(target=(0, 0, 0.5), dist=dist, elev=elev, azim=azim, lens=lens, fstop=1.6, floor=(0.78, 0.76, 0.72), key=1700)
    global CLAY
    CLAY = {"wall": mat("wall", (0.86, 0.85, 0.82), rough=0.7), "roof": mat("roof", (0.13, 0.22, 0.17), rough=0.6), "ground": mat("ground", (0.55, 0.6, 0.52), rough=0.9, noise=0.2, scale=4),
            "road": mat("road", (0.32, 0.33, 0.33), rough=0.85), "accent": mat("accent", (0.76, 0.25, 0.05), rough=0.5), "glass": mat("glass", (0.12, 0.2, 0.26), rough=0.15),
            "tree": mat("tree", (0.16, 0.32, 0.18), rough=0.8), "trunk": mat("trunk", (0.3, 0.2, 0.12), rough=0.8), "steel": mat("steel", (0.6, 0.62, 0.64), rough=0.35, metal=1),
            "blue": mat("blue", (0.08, 0.25, 0.45), rough=0.5), "kraft": mat("kraft", (0.58, 0.4, 0.22), rough=0.8), "concrete": mat("concrete", (0.66, 0.65, 0.62), rough=0.85, noise=0.2, scale=10)}
    place(cylinder("plinth", 6.2, 0.4, seg=96, bevel=0.04, material=CLAY["wall"]), (0, 0, 0.2))
    place(cylinder("ground", 6.0, 0.06, seg=96, material=CLAY["ground"]), (0, 0, 0.43))
    return 0.46

def hall(x, y, sx, sy, h, rz=0.0, saw=0, windows=True):
    C = CLAY; parts = [box("hall", sx, sy, h, 0.02, C["wall"])]; parts[0].location = (0, 0, h / 2)
    if saw:
        w = sx / saw
        for k in range(saw):
            bm = bmesh.new(); vs = [bm.verts.new(v) for v in ((-w / 2, -sy / 2, 0), (w / 2, -sy / 2, 0), (w / 2, -sy / 2, 0.55), (-w / 2, sy / 2, 0), (w / 2, sy / 2, 0), (w / 2, sy / 2, 0.55))]
            for f in ((0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)): bm.faces.new([vs[i] for i in f])
            o = mesh_obj("saw", bm, C["roof"]); o.location = (-sx / 2 + w / 2 + k * w, 0, h); parts.append(o)
            g = box("sk", 0.02, sy - 0.1, 0.45, 0, C["glass"]); g.location = (-sx / 2 + (k + 1) * w - 0.02, 0, h + 0.28); parts.append(g)
    else:
        r = box("roof", sx + 0.1, sy + 0.1, 0.08, 0.01, C["roof"]); r.location = (0, 0, h + 0.04); parts.append(r)
    if windows:
        n = int(sx / 0.5)
        for k in range(n):
            g = box("win", 0.3, 0.02, 0.32, 0, C["glass"]); g.location = (-sx / 2 + 0.35 + k * (sx - 0.7) / max(n - 1, 1), -sy / 2 - 0.005, h * 0.62); parts.append(g)
    for p in parts: link(p)
    group(parts, (x, y, 0.46), rz); return parts

def doors(x, y, sx, n, h, rz=0.0, side=-1, sy=0):
    parts = []
    for k in range(n):
        d = box("door", 0.42, 0.03, h, 0, CLAY["road"]); d.location = (-sx / 2 + (k + 0.5) * sx / n, side * sy / 2, h / 2); parts.append(link(d))
    group(parts, (x, y, 0.46), rz)

def truck(x, y, rz, trailer=True, color="accent"):
    C = CLAY; parts = []
    cab = box("cab", 0.5, 0.55, 0.55, 0.05, C[color]); cab.location = (0.95, 0, 0.38); parts.append(cab)
    ws = box("ws", 0.02, 0.45, 0.22, 0, C["glass"]); ws.location = (1.2, 0, 0.5); parts.append(ws)
    if trailer:
        t = box("trl", 1.6, 0.58, 0.7, 0.03, C["wall"]); t.location = (-0.15, 0, 0.47); parts.append(t)
    for xx in (-0.7, -0.4, 0.95):
        for yy in (-0.28, 0.28):
            w = cylinder("wh", 0.11, 0.08, seg=20, material=C["road"]); w.location = (xx, yy, 0.11); w.rotation_euler = (math.pi / 2, 0, 0); parts.append(w)
    for p in parts: link(p)
    group(parts, (x, y, 0.46), rz)

def tree(x, y, s=1.0):
    place(cylinder("trunk", 0.04 * s, 0.3 * s, seg=8, material=CLAY["trunk"]), (x, y, 0.46 + 0.15 * s))
    o = place(rock("crown", 0.28 * s, CLAY["tree"], flat=1.3), (x, y, 0.46 + 0.55 * s))

def road(x, y, sx, sy, rz=0.0):
    place(box("road", sx, sy, 0.02, 0, CLAY["road"]), (x, y, 0.47), (0, 0, rz))

def stack(x, y, n, size, material, rz=0.0, layers=2):
    parts = []
    for k in range(n):
        for l in range(layers):
            b = box("st", size, size, size, 0.01, material); b.location = ((k % 3) * size * 1.05, (k // 3) * size * 1.05, size / 2 + l * size); parts.append(link(b))
    group(parts, (x, y, 0.46), rz)

def manufacturing():
    diorama_base(21); hall(-0.6, 0.6, 5.0, 3.2, 1.3, rz=0.1, saw=6); road(0.2, -2.6, 9, 1.1, 0.1)
    doors(-0.6, 0.6, 5.0, 4, 0.8, rz=0.1, side=-1, sy=3.24)
    hall(3.3, 1.3, 1.6, 1.8, 1.8, rz=0.1)
    place(cylinder("chim", 0.18, 2.6, seg=24, material=CLAY["steel"]), (2.9, 2.5, 1.76))
    truck(-1.2, -2.5, 0.1); truck(1.6, -2.65, 0.1 + math.pi, color="blue")
    stack(3.0, -1.0, 6, 0.32, CLAY["kraft"], 0.1)
    for (x, y) in ((-4.3, 1.8), (-4.6, 0.4), (-3.6, 3.4), (1.5, 4.3), (4.4, -0.8), (-4.0, -1.4)): tree(x, y, random.uniform(0.8, 1.2))

def recycling():
    diorama_base(22); hall(-1.4, 1.0, 3.6, 2.6, 1.4, rz=-0.08, windows=False); road(0.5, -2.7, 9, 1.1, -0.08)
    doors(-1.4, 1.0, 3.6, 3, 0.9, rz=-0.08, side=-1, sy=2.64)
    for (x, y) in ((1.6, 2.2), (2.6, 2.3)):
        place(cylinder("silo", 0.45, 2.4, seg=40, material=CLAY["steel"]), (x, y, 1.66)); place(cylinder("top", 0.45, 0.35, seg=40, material=CLAY["steel"], r2=0.05), (x, y, 3.04))
    belt = place(box("belt", 2.6, 0.32, 0.08, 0.01, CLAY["accent"]), (1.4, 0.4, 1.3), (0, math.radians(-25), -0.08))
    place(box("hopper", 0.8, 0.8, 0.7, 0.03, CLAY["blue"]), (2.6, -0.1, 0.81))
    cols = [mat("b1", (0.25, 0.5, 0.8), rough=0.6), mat("b2", (0.2, 0.55, 0.3), rough=0.6), mat("b3", (0.85, 0.85, 0.82), rough=0.6)]
    for i, m in enumerate(cols): stack(-3.6 + i * 1.15, -1.0, 3, 0.36, m, -0.08)
    for (x, y, c) in ((3.6, -1.0, "blue"), (3.9, 0.6, "accent")):
        place(tray("cont", 1.3, 0.75, 0.5, 0.05, CLAY[c], 0.01), (x, y, 0.46), (0, 0, -0.08 + 1.5))
    truck(-0.6, -2.65, -0.08, color="blue")
    for (x, y) in ((-4.3, 2.4), (-3.5, 3.6), (0.4, 4.5), (4.5, 2.6), (-4.9, 0.6)): tree(x, y, random.uniform(0.8, 1.2))

def logistics():
    diorama_base(23); hall(-0.4, 1.3, 6.6, 2.8, 1.25, rz=0.05, windows=False); road(0, -1.4, 10, 2.4, 0.05)
    doors(-0.4, 1.3, 6.6, 8, 0.75, rz=0.05, side=-1, sy=2.84)
    for k, x in enumerate((-3.0, -1.6, -0.2, 1.2)):
        truck(x, -0.95, 0.05 + math.pi / 2 if False else 0.05 - math.pi / 2, color=pick(["accent", "blue", "roof"]))
    truck(2.8, -2.3, 0.05, color="blue")
    stack(3.4, 0.2, 6, 0.3, CLAY["kraft"], 0.05)
    for (x, y) in ((-4.6, 3.2), (-2.5, 4.4), (1.8, 4.5), (4.2, 3.2), (-5.2, -0.5)): tree(x, y, random.uniform(0.8, 1.2))

def construction():
    diorama_base(24); C = CLAY
    for lz in range(3):
        place(box("slab", 3.0, 2.2, 0.12, 0.01, C["concrete"]), (-0.8, 0.8, 0.52 + lz * 0.85))
        for (x, y) in ((-2.2, -0.2), (0.6, -0.2), (-2.2, 1.8), (0.6, 1.8), (-0.8, -0.2), (-0.8, 1.8)):
            if lz < 2: place(box("col", 0.14, 0.14, 0.75, 0, C["concrete"]), (x, y, 0.95 + lz * 0.85))
    place(box("mast", 0.2, 0.2, 2.9, 0, C["accent"]), (2.0, 1.6, 1.91)); place(box("jib", 4.4, 0.16, 0.16, 0, C["accent"]), (1.0, 1.6, 3.4))
    place(box("cw", 0.55, 0.4, 0.32, 0.02, C["concrete"]), (3.5, 1.6, 3.22)); place(box("cab", 0.32, 0.32, 0.28, 0.02, C["wall"]), (2.0, 1.32, 3.18))
    place(cylinder("hook", 0.01, 1.2, seg=6, material=C["steel"]), (-0.5, 1.6, 2.8)); place(box("load", 0.5, 0.3, 0.12, 0.01, C["kraft"]), (-0.5, 1.6, 2.15))
    sand = mat("sand", (0.7, 0.6, 0.45), rough=0.95, noise=0.3)
    place(rock("heap", 1.0, sand, flat=0.5), (2.9, -1.4, 0.55))
    place(tray("cont", 1.4, 0.8, 0.5, 0.05, C["blue"], 0.01), (-3.4, -1.6, 0.46), (0, 0, 0.3))
    road(0, -3.2, 10, 1.0, 0.0); truck(0.4, -3.2, 0.0)
    for (x, y) in ((-4.6, 2.5), (-3.8, 3.8), (4.2, 3.4), (4.8, 1.5)): tree(x, y, random.uniform(0.8, 1.2))

def packaging():
    diorama_base(25); hall(-0.8, 1.2, 4.6, 2.8, 1.35, rz=-0.06); road(0.3, -2.6, 9, 1.1, -0.06)
    doors(-0.8, 1.2, 4.6, 3, 0.85, rz=-0.06, side=-1, sy=2.84)
    film = mat("film", (0.9, 0.95, 0.97), rough=0.04, trans=0.95)
    stack(-3.6, -1.4, 6, 0.34, CLAY["kraft"], -0.06); stack(1.0, -1.4, 3, 0.34, CLAY["kraft"], -0.06, layers=1)
    for k in range(3):
        x = 2.4 + (k % 2) * 0.9; y = -0.6 + k * 0.9
        place(box("pal", 0.8, 0.8, 0.1, 0.01, CLAY["kraft"]), (x, y, 0.51)); place(box("load", 0.76, 0.76, 0.7, 0.04, film), (x, y, 0.91))
        place(box("inner", 0.7, 0.7, 0.66, 0.01, CLAY["kraft"]), (x, y, 0.9))
    for k in range(4): place(cylinder("roll", 0.22, 0.6, seg=32, material=film), (-3.4 + k * 0.5, -1.78, 0.68), (0, math.pi / 2, -0.06))
    truck(-0.8, -2.55, -0.06, color="blue")
    for (x, y) in ((-4.4, 2.6), (-3.4, 3.9), (1.6, 4.4), (4.4, 2.2)): tree(x, y, random.uniform(0.8, 1.2))

MOTIFS = {f.__name__: f for f in (pet, granulate, regrind, sheet, film, component, mixed, bales, metals, wood, paper, glass, textiles, minerals, surplus, electronics,
                                   manufacturing, recycling, logistics, construction, packaging)}

FILES = {"manufacturing": "producer", "recycling": "recycler", "pet": "pet-flakes"}  # the guide's two sides use these names

def render(name):
    MOTIFS[name](); s = bpy.context.scene
    s.render.filepath = os.path.join(OUT, f"{FILES.get(name, name)}.jpg")
    s.render.image_settings.file_format = "JPEG"; s.render.image_settings.quality = 86
    bpy.ops.render.render(write_still=True); print("rendered", name)

os.makedirs(OUT, exist_ok=True)
for name in (ARGS[1:] or list(MOTIFS)):
    render(name)
