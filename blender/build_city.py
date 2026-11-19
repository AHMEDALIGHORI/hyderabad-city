"""
Hyderabad, Sindh — a stylised city with a Vice City sunset and a San Andreas
street level. Built procedurally in Blender, exported as one glTF for the web.

    import runpy; runpy.run_path(r"E:\\hyderabad-city\\blender\\build_city.py", run_name="__main__")

Outputs
  E:\\hyderabad-city\\blender\\hyderabad.blend
  E:\\hyderabad-city\\public\\models\\hyderabad.glb
  E:\\hyderabad-city\\public\\textures\\*.png
"""

import math
import os
import random

import bpy
import numpy as np
from mathutils import Vector

ROOT = r"E:\hyderabad-city"
TEX_DIR = os.path.join(ROOT, "public", "textures")
MODEL_DIR = os.path.join(ROOT, "public", "models")
BLEND_PATH = os.path.join(ROOT, "blender", "hyderabad.blend")
GLB_PATH = os.path.join(MODEL_DIR, "hyderabad.glb")

os.makedirs(TEX_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

rng = random.Random(20031120)

# Vice City sunset + San Andreas grit, mixed with Sindhi pastel facades
NEON_PINK = (1.0, 0.31, 0.64)
NEON_CYAN = (0.31, 0.89, 1.0)
NEON_YELLOW = (1.0, 0.82, 0.40)
SAND = (0.62, 0.52, 0.38)
ASPHALT = (0.045, 0.045, 0.055)


# --------------------------------------------------------------------------- #
# scene reset + helpers
# --------------------------------------------------------------------------- #
def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images,
                 bpy.data.cameras, bpy.data.lights, bpy.data.curves):
        for item in list(coll):
            try:
                if item.users == 0:
                    coll.remove(item)
            except Exception:
                pass


def _save_png(pixels, w, h, path, name):
    img = bpy.data.images.new(name, width=w, height=h, alpha=False)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = pixels
    img.pixels.foreach_set(rgba.reshape(-1))
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    return img


def make_facade_texture(prefix, wall, trim, lit_a, lit_b, lit_ratio, floors, cols, seed):
    """A photographed-feeling facade: sills, lintels, balconies, AC units,
    grime, curtains. Returns a base map and a lit-window emissive map."""
    r = random.Random(seed)
    w, h = 1024, 1024
    base = np.zeros((h, w, 3), dtype=np.float32)
    base[:] = wall
    emis = np.zeros((h, w, 3), dtype=np.float32)

    # --- wall grain + vertical grime (dirt collects under sills)
    noise = np.random.RandomState(seed).normal(0, 0.018, (h, w, 1)).astype(np.float32)
    base = np.clip(base + noise, 0, 1)
    grime = np.linspace(0.16, 0.0, h, dtype=np.float32)[:, None, None]
    base = np.clip(base - grime * np.array(wall, dtype=np.float32), 0, 1)

    cw = w // cols
    ch = h // floors

    for fy in range(floors):
        for fx in range(cols):
            x0 = fx * cw + int(cw * 0.16)
            x1 = (fx + 1) * cw - int(cw * 0.16)
            y0 = fy * ch + int(ch * 0.22)
            y1 = (fy + 1) * ch - int(ch * 0.30)

            # lintel above and sill below the opening
            base[y0 - 6:y0, x0 - 4:x1 + 4] = trim
            base[y1:y1 + 5, x0 - 6:x1 + 6] = trim

            lit = r.random() < lit_ratio
            if lit:
                colour = lit_a if r.random() < 0.72 else lit_b
                k = r.uniform(0.55, 1.15)
                base[y0:y1, x0:x1] = [c * 0.35 for c in colour]
                emis[y0:y1, x0:x1] = [min(1.0, c * k) for c in colour]

                # curtain / blind silhouette on some windows
                if r.random() < 0.45:
                    split = int((y1 - y0) * r.uniform(0.25, 0.6))
                    base[y0:y0 + split, x0:x1] = [c * 0.22 for c in colour]
                    emis[y0:y0 + split, x0:x1] *= 0.25
                # a person-shaped shadow in a few windows
                if r.random() < 0.12:
                    px = r.randint(x0 + 4, max(x0 + 5, x1 - 8))
                    py = r.randint(y0 + 8, max(y0 + 9, y1 - 10))
                    base[py:y1 - 2, px:px + 6] = [c * 0.12 for c in colour]
                    emis[py:y1 - 2, px:px + 6] *= 0.3
            else:
                base[y0:y1, x0:x1] = [c * 0.22 for c in wall]
                # faint reflection so dark glass is not pure black
                base[y0:y1, x0:x1] += np.linspace(0.06, 0.0, y1 - y0, dtype=np.float32)[:, None, None]

            # window frame
            base[y0:y1, x0:x0 + 2] = trim
            base[y0:y1, x1 - 2:x1] = trim
            base[y0:y0 + 2, x0:x1] = trim
            base[y1 - 2:y1, x0:x1] = trim

        # --- balcony band on some floors
        if r.random() < 0.55:
            by = (fy + 1) * ch - int(ch * 0.34)
            base[by:by + 4, :] = trim
            base[by + 4:by + 9, :] = [c * 0.75 for c in trim]
            for rx in range(0, w, 10):
                base[by - 10:by, rx:rx + 2] = [c * 0.6 for c in trim]

        # --- AC units bolted to the facade
        for _ in range(int(cols * 0.6)):
            ax = r.randint(4, w - 40)
            ay = fy * ch + int(ch * 0.62)
            base[ay:ay + 16, ax:ax + 30] = [0.30, 0.30, 0.32]
            base[ay + 2:ay + 14, ax + 2:ax + 28] = [0.22, 0.22, 0.24]
            base[ay + 16:ay + 18, ax:ax + 30] = [0.18, 0.18, 0.20]
            # rust streak under the unit
            base[ay + 18:ay + 40, ax + 8:ax + 14] *= 0.86

    # floor cornice lines
    for fy in range(floors + 1):
        y = min(h - 1, fy * ch)
        base[y:y + 5, :] = trim
        base[y + 5:y + 7, :] *= 0.85

    base[0:12, :] = trim
    base = np.clip(base, 0, 1)

    _save_png(base[::-1], w, h, os.path.join(TEX_DIR, f"{prefix}_base.png"), f"{prefix}_base")
    _save_png(emis[::-1], w, h, os.path.join(TEX_DIR, f"{prefix}_emissive.png"), f"{prefix}_emissive")


def make_sky_texture():
    w, h = 1024, 512
    sky = np.zeros((h, w, 3), dtype=np.float32)
    top = np.array([0.10, 0.05, 0.22], dtype=np.float32)
    mid = np.array([0.55, 0.16, 0.42], dtype=np.float32)
    low = np.array([1.00, 0.45, 0.28], dtype=np.float32)
    glow = np.array([1.00, 0.72, 0.38], dtype=np.float32)
    for i in range(h):
        t = 1.0 - i / (h - 1)
        if t < 0.22:
            f = t / 0.22
            c = glow * (1 - f) + low * f
        elif t < 0.5:
            f = (t - 0.22) / 0.28
            c = low * (1 - f) + mid * f
        else:
            f = (t - 0.5) / 0.5
            c = mid * (1 - f) + top * f
        sky[i, :, :] = c
    r = random.Random(5)
    for _ in range(500):
        sx, sy = r.randrange(w), r.randrange(int(h * 0.55), h)
        b = r.uniform(0.15, 0.6)
        sky[sy, sx] = np.clip(sky[sy, sx] + b, 0, 1)
    sky = sky[::-1]
    _save_png(sky, w, h, os.path.join(TEX_DIR, "sky.png"), "sky")


def make_road_texture():
    w = h = 512
    img = np.zeros((h, w, 3), dtype=np.float32)
    img[:] = ASPHALT
    r = random.Random(9)
    for _ in range(4000):
        x, y = r.randrange(w), r.randrange(h)
        v = r.uniform(0.02, 0.10)
        img[y, x] = [v, v, v + 0.005]
    # lane dashes down the middle
    for y in range(0, h, 64):
        img[y:y + 32, w // 2 - 6:w // 2 + 6] = [0.75, 0.68, 0.35]
    _save_png(img, w, h, os.path.join(TEX_DIR, "road.png"), "road")


def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def simple_mat(name, color, rough=0.7, metal=0.0, emission=None, strength=1.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    b = principled(mat)
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emission:
        b.inputs["Emission Color"].default_value = (*emission, 1.0)
        b.inputs["Emission Strength"].default_value = strength
    return mat


def texture_mat(name, base_img, emis_img, strength=1.2, rough=0.7, metal=0.05):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    base = nt.nodes.new("ShaderNodeTexImage")
    base.image = base_img
    emis = nt.nodes.new("ShaderNodeTexImage")
    emis.image = emis_img
    emis.image.colorspace_settings.name = "sRGB"
    nt.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.18
    bump.inputs["Distance"].default_value = 0.05
    nt.links.new(base.outputs["Color"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(emis.outputs["Color"], bsdf.inputs["Emission Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def emission_mat(name, color, strength):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    b = principled(mat)
    b.inputs["Base Color"].default_value = (0, 0, 0, 1)
    b.inputs["Roughness"].default_value = 1.0
    b.inputs["Emission Color"].default_value = (*color, 1.0)
    b.inputs["Emission Strength"].default_value = strength
    return mat


def box(name, size, loc, mat, rot=(0, 0, 0), bevel=0.0, uv_scale=6.0):
    sx, sy, sz = (s * 0.5 for s in size)
    verts = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
             (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
             (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        n = poly.normal
        for li in poly.loop_indices:
            v = mesh.vertices[mesh.loops[li].vertex_index].co
            if abs(n.z) > 0.5:
                a, b = v.x, v.y
            elif abs(n.x) > 0.5:
                a, b = v.y, v.z
            else:
                a, b = v.x, v.z
            uv.data[li].uv = (a / uv_scale, b / uv_scale)
        poly.use_smooth = False
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(mat)
    ob.location = loc
    ob.rotation_euler = rot
    if bevel > 0:
        mod = ob.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    return ob


def cylinder(name, radius, depth, loc, mat, verts=20, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth,
                                        location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat)
    return ob


def cone(name, r1, r2, depth, loc, mat, verts=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2,
                                    depth=depth, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat)
    return ob


def plane(name, size, loc, rot, mat):
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.scale = (size[0], size[1], 1)
    ob.data.materials.append(mat)
    return ob


def sign_text(text, loc, rot, size, mat, extrude=0.04, mirror=False):
    curve = bpy.data.curves.new(text, type="FONT")
    curve.body = text
    curve.size = size
    curve.extrude = extrude
    curve.align_x = "CENTER"
    ob = bpy.data.objects.new(text, curve)
    ob.location = loc
    ob.rotation_euler = rot
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.object
    ob.data.materials.append(mat)
    if mirror:
        # bake the flip into the mesh so it survives export
        for v in ob.data.vertices:
            v.co.x = -v.co.x
    ob.select_set(False)
    return ob


# --------------------------------------------------------------------------- #
# city
# --------------------------------------------------------------------------- #
BUILDINGS = []   # every building, so the street layer can dress them

BLOCK = 46.0          # building block
ROAD = 14.0           # road width
PITCH = BLOCK + ROAD  # 60
GRID = 3              # -3..3 blocks each way


def make_sand_texture():
    w = h = 512
    img = np.zeros((h, w, 3), dtype=np.float32)
    img[:] = SAND
    r = random.Random(11)
    for _ in range(9000):
        x, y = r.randrange(w), r.randrange(h)
        v = r.uniform(-0.05, 0.06)
        img[y, x] = np.clip(img[y, x] + v, 0, 1)
    for _ in range(120):
        x, y = r.randrange(w), r.randrange(h)
        rad = r.randint(4, 16)
        img[max(0, y - rad):y + rad, max(0, x - rad):x + rad] *= r.uniform(0.92, 1.05)
    _save_png(img, w, h, os.path.join(TEX_DIR, "sand.png"), "sand")


def build_ground(mats):
    road = bpy.data.images["road"]
    road_mat = texture_mat("RoadMat", road, road, 0.15, 0.9, 0.0)
    make_sand_texture()
    sand_img = bpy.data.images["sand"]
    sand = texture_mat("SandGround", sand_img, sand_img, 0.05, 0.95, 0.0)
    size = GRID * 2 + 1
    span = size * PITCH
    box("CityGround", (span + 200, span + 200, 0.6), (0, 0, -0.3), sand, uv_scale=12)

    for i in range(-GRID, GRID + 1):
        offset = i * PITCH - PITCH * 0.5 + PITCH * 0.5
        box(f"RoadX_{i}", (span + ROAD, ROAD, 0.12), (0, offset - PITCH * 0.5 + ROAD * 0.5, 0.06),
            road_mat, uv_scale=8)
        box(f"RoadY_{i}", (ROAD, span + ROAD, 0.12), (offset - PITCH * 0.5 + ROAD * 0.5, 0, 0.06),
            road_mat, uv_scale=8)

    # promenade edge + sea to the west
    water = simple_mat("Water", (0.03, 0.08, 0.12), 0.15, 0.2,
                       emission=(0.10, 0.28, 0.42), strength=0.5)
    box("Sea", (260, span + 260, 0.4), (-span * 0.5 - 150, 0, -0.1), water)

    # raised pavement slabs + curbs around every block
    paving = simple_mat("Paving", (0.30, 0.28, 0.26), 0.9)
    curb = simple_mat("Curb", (0.55, 0.52, 0.46), 0.85)
    for bx in range(-GRID, GRID + 1):
        for by in range(-GRID, GRID + 1):
            if bx == 0 and by == 0:
                continue
            cx, cy = bx * PITCH, by * PITCH
            box(f"Pave_{bx}_{by}", (BLOCK, BLOCK, 0.16), (cx, cy, 0.08), paving, uv_scale=6)
            for side, (sx, sy, w, d) in enumerate((
                (0, -BLOCK / 2, BLOCK, 0.5),
                (0, BLOCK / 2, BLOCK, 0.5),
                (-BLOCK / 2, 0, 0.5, BLOCK),
                (BLOCK / 2, 0, 0.5, BLOCK),
            )):
                box(f"Curb_{bx}_{by}_{side}", (w, d, 0.22), (cx + sx, cy + sy, 0.11), curb)


def build_block(bx, by, facade_mats, neon_pool, props):
    """One city block: 2-4 pastel buildings with awnings, roof props and a sign."""
    cx, cy = bx * PITCH, by * PITCH
    block = BLOCK
    inset = 3.0
    usable = block - inset * 2
    count = rng.randint(2, 4)
    marks = sorted(rng.uniform(0.12, 0.88) for _ in range(count - 1))
    edges = [0.0] + marks + [1.0]
    for i in range(count):
        w = usable * (edges[i + 1] - edges[i]) * 0.94
        d = usable * rng.uniform(0.55, 0.95)
        h = rng.choice([9, 12, 15, 18, 21, 26, 30])
        x = cx - block / 2 + inset + usable * (edges[i] + edges[i + 1]) / 2
        y = cy + rng.uniform(-4, 4)
        mat = facade_mats[rng.randrange(len(facade_mats))]
        name = f"Bldg_{bx}_{by}_{i}"
        b = box(name, (w, d, h), (x, y, h / 2), mat, bevel=0.12, uv_scale=10)
        props.append(b)
        BUILDINGS.append({"x": x, "y": y, "w": w, "d": d, "h": h,
                          "bx": bx, "by": by, "name": name})

        # rooftop kit
        box(f"{name}_roof", (w + 0.5, d + 0.5, 0.35), (x, y, h + 0.15),
            simple_mat("Parapet", (0.35, 0.33, 0.30), 0.9), bevel=0.05)
        if rng.random() < 0.7:
            cylinder(f"{name}_tank", 0.9, 1.4, (x + rng.uniform(-2, 2), y + rng.uniform(-2, 2), h + 1.0),
                     simple_mat("Tank", (0.18, 0.18, 0.20), 0.6, 0.4), 14)
        if rng.random() < 0.6:
            box(f"{name}_ac", (1.6, 1.1, 0.8), (x - w * 0.25, y + d * 0.2, h + 0.7),
                simple_mat("AC", (0.20, 0.21, 0.23), 0.5, 0.6), bevel=0.04)

        # awning strip over the street (VC pastel, lit)
        if rng.random() < 0.75:
            col = rng.choice([NEON_PINK, NEON_CYAN, NEON_YELLOW])
            box(f"{name}_awn", (w * 0.9, 1.1, 0.16),
                (x, y - d / 2 - 0.5, 3.4), emission_mat("AwningNeon", col, 1.1))

        # vertical neon sign on some corners
        if rng.random() < 0.45:
            col = rng.choice([NEON_PINK, NEON_CYAN, NEON_YELLOW])
            sy = y - d / 2 - 0.9
            box(f"{name}_signboard", (0.25, 0.25, 5.5),
                (x + w / 2 - 0.6, sy, h * 0.55), simple_mat("SignBoard", (0.05, 0.05, 0.06), 0.5, 0.7))
            box(f"{name}_neon", (0.10, 0.10, 5.0),
                (x + w / 2 - 0.6, sy - 0.2, h * 0.55), emission_mat("SignNeon", col, 3.0))
            neon_pool.append(col)


def build_palms(spots, trunk_mat, leaf_mat):
    for i, (x, y, scale) in enumerate(spots):
        h = 7.5 * scale
        cylinder(f"Palm_{i}_trunk", 0.22 * scale, h, (x, y, h / 2),
                 trunk_mat, 10, rot=(math.radians(rng.uniform(-4, 4)), 0, 0))
        for f in range(7):
            a = f * (math.tau / 7) + rng.uniform(-0.2, 0.2)
            cone(f"Palm_{i}_leaf{f}", 0.09 * scale, 0.02, 4.2 * scale,
                 (x + math.cos(a) * 1.6 * scale, y + math.sin(a) * 1.6 * scale, h + 0.4),
                 leaf_mat, 6,
                 rot=(math.radians(78), 0, a))


def build_rickshaw(x, y, rot, mats):
    body = mats["yellow"]
    black = mats["black"]
    group = []
    group.append(box(f"Rick_{x}_{y}_body", (2.6, 1.3, 1.25), (x, y, 0.95), body,
                     rot=(0, 0, rot), bevel=0.08))
    group.append(box(f"Rick_{x}_{y}_top", (2.2, 1.2, 0.55), (x, y, 1.85), black,
                     rot=(0, 0, rot), bevel=0.06))
    for dx, dy in ((-1.0, 0.55), (1.0, 0.55), (-1.0, -0.55), (1.0, -0.55)):
        ox = dx * math.cos(rot) - dy * math.sin(rot)
        oy = dx * math.sin(rot) + dy * math.cos(rot)
        cylinder(f"Rick_{x}_{y}_wheel{dx}{dy}", 0.32, 0.18, (x + ox, y + oy, 0.34),
                 black, 12, rot=(math.radians(90), 0, rot))
    return group


def build_sedan(x, y, rot, mat):
    box(f"Sedan_{x}_{y}_body", (4.4, 1.9, 0.85), (x, y, 0.75), mat, rot=(0, 0, rot), bevel=0.12)
    box(f"Sedan_{x}_{y}_cabin", (2.2, 1.7, 0.7), (x - 0.2 * math.cos(rot), y - 0.2 * math.sin(rot), 1.45),
        simple_mat("Glass", (0.05, 0.10, 0.14), 0.15, 0.4), rot=(0, 0, rot), bevel=0.08)


def build_landmarks(mats):
    stone = simple_mat("Sandstone", (0.55, 0.42, 0.28), 0.85)
    trim = simple_mat("StoneTrim", (0.72, 0.60, 0.42), 0.8)
    neon = emission_mat("LandmarkNeon", NEON_CYAN, 6.0)

    # Pakka Qila gate at the north end of the main avenue
    gx, gy = 0, GRID * PITCH + 30
    box("Qila_gate", (18, 5, 12), (gx, gy, 6), stone, bevel=0.2)
    box("Qila_arch", (6, 6, 8), (gx, gy, 4), simple_mat("ArchDark", (0.06, 0.05, 0.05), 1.0), bevel=0.1)
    for side in (-1, 1):
        cylinder(f"Qila_tower_{side}", 4.0, 16, (gx + side * 8.5, gy, 8), stone, 20)
        cone(f"Qila_cap_{side}", 4.3, 2.6, 3.2, (gx + side * 8.5, gy, 17.4), trim, 20)
    for i in range(9):
        box(f"Qila_crenel_{i}", (1.2, 1.2, 1.4), (gx - 8 + i * 2, gy - 2.6, 12.6), trim)
    sign_text("PAKKA QILA", (gx, gy - 3.2, 9.4), (math.radians(90), 0, 0), 1.5, neon)

    # clock tower on the central roundabout
    tx, ty = 0, 0
    cylinder("Tower_base", 3.4, 4, (tx, ty, 2), stone, 8)
    cylinder("Tower_shaft", 2.2, 18, (tx, ty, 13), trim, 8)
    cylinder("Tower_head", 3.0, 3.2, (tx, ty, 23.6), stone, 8)
    cone("Tower_spire", 3.2, 0.2, 5.0, (tx, ty, 27.7), stone, 8)
    for i in range(4):
        a = i * math.pi / 2
        plane(f"Tower_clock_{i}", (2.0, 2.0), (tx + math.cos(a) * 2.25, ty + math.sin(a) * 2.25, 23.6),
              (math.radians(90), 0, a + math.pi / 2), emission_mat("ClockFace", (1.0, 0.92, 0.75), 1.6))
    sign_text("HYDERABAD", (tx, ty - 3.1, 16.5), (math.radians(90), 0, 0), 1.8, neon)

    # bazaar: awnings and lanterns down one side street
    cloth = [emission_mat("BazaarCloth1", NEON_PINK, 1.6),
             emission_mat("BazaarCloth2", NEON_YELLOW, 1.6),
             emission_mat("BazaarCloth3", NEON_CYAN, 1.6)]
    for i in range(10):
        bx = -PITCH * 1.5 - 6 + (i % 5) * 7.0
        by = -PITCH * 1.5 + 12 - (i // 5) * 26
        box(f"Bazaar_awning_{i}", (6.0, 4.0, 0.2), (bx, by, 3.2), cloth[i % 3],
            rot=(math.radians(6), 0, 0))
        for j in range(3):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.22,
                                                 location=(bx - 2 + j * 2, by - 1.6, 2.6))
            lamp = bpy.context.object
            lamp.name = f"Lantern_{i}_{j}"
            lamp.data.materials.append(emission_mat("LanternGlow", (1.0, 0.74, 0.36), 5.0))

    # waterfront promenade railing + a distant bridge
    rail = simple_mat("Rail", (0.20, 0.22, 0.24), 0.5, 0.6)
    west = -GRID * PITCH - 40
    for i in range(24):
        y = -140 + i * 12
        box(f"Rail_post_{i}", (0.25, 0.25, 1.2), (west, y, 0.6), rail)
    box("Rail_top", (0.3, 300, 0.2), (west, 0, 1.2), rail)
    # bridge over the water
    for i in range(6):
        box(f"Bridge_pier_{i}", (3, 3, 18), (west - 30 - i * 34, 40, 9), stone)
    box("Bridge_deck", (210, 12, 1.2), (west - 120, 40, 18.6), stone)
    for i in range(9):
        box(f"Bridge_cable_{i}", (0.25, 0.25, 6), (west - 40 - i * 24, 36, 22), emission_mat("BridgeLight", NEON_PINK, 3.0))



# --------------------------------------------------------------------------- #
# street level: shops, restaurants, bazaar
# --------------------------------------------------------------------------- #
SHOPS = [
    ("CHAI KHANA", (1.0, 0.82, 0.40)),
    ("BIRYANI CENTRE", (1.0, 0.31, 0.64)),
    ("PAKWAN HOUSE", (1.0, 0.82, 0.40)),
    ("MITHAAI SHOP", (1.0, 0.31, 0.64)),
    ("MOBILE ZONE", (0.31, 0.89, 1.0)),
    ("CLOTH HOUSE", (1.0, 0.82, 0.40)),
    ("KIRANA STORE", (1.0, 0.55, 0.30)),
    ("PHARMACY", (0.31, 0.89, 1.0)),
    ("BAKERY", (1.0, 0.72, 0.45)),
    ("NIHARI HOUSE", (1.0, 0.31, 0.64)),
    ("HALEEM CORNER", (1.0, 0.82, 0.40)),
    ("FRUIT CORNER", (1.0, 0.62, 0.20)),
    ("ICE CREAM", (0.31, 0.89, 1.0)),
    ("CYBER CAFE", (0.31, 0.89, 1.0)),
    ("AUTO PARTS", (1.0, 0.82, 0.40)),
    ("SINDHI TOPI", (1.0, 0.31, 0.64)),
    ("AJRAK HOUSE", (1.0, 0.62, 0.30)),
    ("BARBER SHOP", (0.31, 0.89, 1.0)),
    ("GOLD JEWELLERS", (1.0, 0.86, 0.42)),
    ("BOOK DEPOT", (1.0, 0.72, 0.45)),
    ("JEANS CORNER", (0.31, 0.89, 1.0)),
    ("PAAN SHOP", (1.0, 0.31, 0.64)),
    ("LAASI SHOP", (1.0, 0.86, 0.42)),
    ("TAILOR MASTER", (0.31, 0.89, 1.0)),
    ("FURNITURE MART", (1.0, 0.72, 0.45)),
    ("WATCH REPAIR", (1.0, 0.82, 0.40)),
    ("SHOE HOUSE", (1.0, 0.31, 0.64)),
    ("SPICE MARKET", (1.0, 0.62, 0.20)),
    ("PAPER MART", (1.0, 0.82, 0.40)),
    ("SINDHI BIRYANI", (1.0, 0.31, 0.64)),
]


def build_shopfront(b, index, named=True):
    """A lit shopfront on the building's city-facing side."""
    x, y, w, d = b["x"], b["y"], b["w"], b["d"]
    facing = -1 if y >= 0 else 1           # shop faces the centre of town
    face_y = y + facing * (d / 2 + 0.28)
    rot = (math.radians(-90), 0, 0) if facing < 0 else (math.radians(90), 0, math.pi)
    name, colour = SHOPS[index % len(SHOPS)]

    dark = simple_mat("ShopDark", (0.045, 0.040, 0.045), 0.6, 0.2)
    warm = emission_mat("ShopInterior", (1.0, 0.70, 0.42), 0.9)
    glass = simple_mat("ShopGlass", (0.05, 0.07, 0.09), 0.15, 0.5)
    neon = emission_mat(f"ShopNeon_{index % 6}", colour, 1.6)

    # lit interior recess
    box(f"Shop_{index}_inner", (w * 0.80, 0.30, 2.7), (x, face_y + facing * 0.30, 1.35), dark)
    plane(f"Shop_{index}_glow", (w * 0.74, 2.3), (x, face_y + facing * 0.12, 1.45),
          rot, warm)
    # counter + shelves, visible through the opening
    box(f"Shop_{index}_counter", (w * 0.52, 0.55, 1.0),
        (x, face_y - facing * 0.55, 0.5), glass, bevel=0.03)
    for shelf in range(2):
        box(f"Shop_{index}_shelf{shelf}", (w * 0.62, 0.28, 0.10),
            (x, face_y + facing * 0.30, 1.5 + shelf * 0.55), dark)

    # signboard + name
    box(f"Shop_{index}_board", (w * 0.92, 0.34, 1.15), (x, face_y + facing * 0.16, 3.55), dark,
        bevel=0.03)
    if named:
        text_rot = (math.radians(90), 0, 0) if facing < 0 else (math.radians(-90), 0, math.pi)
        sign_text(name, (x, face_y + facing * 0.30, 3.55), text_rot,
                  min(0.62, w * 0.12), neon, extrude=0.03, mirror=(facing > 0))
    else:
        box(f"Shop_{index}_stripe", (w * 0.86, 0.08, 0.10),
            (x, face_y + facing * 0.30, 3.55), neon)

    # awning over the opening
    box(f"Shop_{index}_awn", (w * 0.88, 1.5, 0.10),
        (x, face_y + facing * 0.9, 3.0), neon,
        rot=(math.radians(8 * facing), 0, 0))

    # street props: crates, a stool
    for k in range(rng.randint(1, 3)):
        px = x + rng.uniform(-w * 0.35, w * 0.35)
        py = face_y + facing * rng.uniform(0.7, 1.6)
        box(f"Shop_{index}_crate{k}", (0.6, 0.6, 0.55), (px, py, 0.28),
            simple_mat("Crate", (0.30, 0.20, 0.10), 0.9), bevel=0.02)


def build_shopfronts():
    """Every building gets a front; the central blocks get readable names."""
    for i, b in enumerate(BUILDINGS):
        central = abs(b["bx"]) <= 1 and abs(b["by"]) <= 2 or abs(b["by"]) <= 1
        build_shopfront(b, i, named=central)


def build_food_street():
    """A lane of restaurants with tables on the pavement and lights overhead."""
    lane_y = -PITCH * 2 - 6
    warm = emission_mat("FoodWarm", (1.0, 0.66, 0.36), 1.8)
    pink = emission_mat("FoodPink", (1.0, 0.31, 0.64), 2.2)
    amber = emission_mat("FoodAmber", (1.0, 0.82, 0.40), 2.2)
    dark = simple_mat("FoodDark", (0.05, 0.045, 0.05), 0.6)

    names = ["BIRYANI", "TIKKA", "HALEEM", "KARAHI", "ROLLS", "NIHARI", "CHAI", "MITHAI"]
    for i, name in enumerate(names):
        x = -PITCH * 1.5 + i * 16
        box(f"Food_{i}_base", (13, 8, 5.2), (x, lane_y - 9, 2.6), dark, bevel=0.1)
        plane(f"Food_{i}_glow", (11.5, 2.6), (x, lane_y - 4.9, 1.6),
              (math.radians(-90), 0, math.pi), warm)
        box(f"Food_{i}_board", (12.6, 0.3, 1.5), (x, lane_y - 4.8, 5.4), dark, bevel=0.04)
        sign_text(name, (x, lane_y - 4.62, 5.4), (math.radians(-90), 0, math.pi),
                  0.78, [pink, amber][i % 2], extrude=0.04)
        box(f"Food_{i}_awn", (12.8, 2.6, 0.12), (x, lane_y - 6.2, 4.3), [pink, amber][i % 2],
            rot=(math.radians(-10), 0, 0))

        # tables + stools on the pavement
        for t in range(3):
            tx = x - 4 + t * 4
            ty = lane_y - 1.4
            cylinder(f"Food_{i}_table{t}", 0.55, 0.08, (tx, ty, 0.75), dark, 12)
            cylinder(f"Food_{i}_leg{t}", 0.07, 0.75, (tx, ty, 0.38), dark, 8)
            for s in (-1, 1):
                cylinder(f"Food_{i}_stool{i}_{t}_{s}", 0.22, 0.45,
                         (tx + s * 0.95, ty + rng.uniform(-0.3, 0.3), 0.23), dark, 8)

    # string lights across the lane
    for i in range(14):
        x = -PITCH * 1.5 + i * 9
        for j in range(5):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.13,
                                                 location=(x - 3 + j * 1.5, lane_y - 3.2,
                                                           5.0 - math.sin(j / 4 * math.pi) * 0.5))
            bulb = bpy.context.object
            bulb.name = f"Food_bulb_{i}_{j}"
            bulb.data.materials.append(emission_mat("FoodBulb", (1.0, 0.80, 0.50), 3.0))


def build_bazaar():
    """Cloth-and-spice stalls under canopies, with goods stacked in front."""
    cloth = [emission_mat("Stall1", (1.0, 0.31, 0.64), 2.4),
             emission_mat("Stall2", (1.0, 0.82, 0.40), 2.4),
             emission_mat("Stall3", (0.31, 0.89, 1.0), 2.4),
             emission_mat("Stall4", (0.42, 0.90, 0.55), 2.4)]
    wood = simple_mat("StallWood", (0.30, 0.20, 0.10), 0.9)
    goods = [simple_mat("Goods1", (0.55, 0.16, 0.12), 0.8),
             simple_mat("Goods2", (0.70, 0.52, 0.16), 0.8),
             simple_mat("Goods3", (0.20, 0.35, 0.22), 0.8)]

    gx, gy = -PITCH * 2 - 8, PITCH * 1.5
    for i in range(8):
        x = gx + (i % 4) * 11
        y = gy - (i // 4) * 14
        for px in (-2.2, 2.2):
            for py in (-1.6, 1.6):
                cylinder(f"Stall_{i}_post{px}{py}", 0.07, 2.6, (x + px, y + py, 1.3), wood, 6)
        box(f"Stall_{i}_canopy", (5.4, 4.0, 0.10), (x, y, 2.65), cloth[i % 4],
            rot=(math.radians(4), 0, 0))
        box(f"Stall_{i}_table", (4.6, 1.6, 0.12), (x, y, 0.9), wood)
        for k in range(4):
            box(f"Stall_{i}_goods{k}", (0.8, 0.8, 0.5),
                (x - 1.6 + k * 1.1, y + rng.uniform(-0.3, 0.3), 1.2), goods[k % 3], bevel=0.04)


def build_landmarks_extra():
    """Mosque, cinema, bus stand, petrol pump, bazaar gate."""
    stone = simple_mat("MosqueStone", (0.86, 0.82, 0.72), 0.85)
    green = simple_mat("DomeGreen", (0.14, 0.42, 0.30), 0.35, 0.5,
                       emission=(0.10, 0.32, 0.22), strength=0.4)
    neon = emission_mat("ExtraNeon", (0.31, 0.89, 1.0), 3.0)
    pink = emission_mat("ExtraPink", (1.0, 0.31, 0.64), 3.0)
    amber = emission_mat("ExtraAmber", (1.0, 0.82, 0.40), 3.0)
    dark = simple_mat("ExtraDark", (0.05, 0.05, 0.06), 0.6)

    # --- mosque (south-west of the centre)
    mx, my = -PITCH * 2.2, -PITCH * 2.2
    box("Masjid_hall", (22, 16, 9), (mx, my, 4.5), stone, bevel=0.2)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=8,
                                         location=(mx, my, 11.5))
    dome = bpy.context.object
    dome.name = "Masjid_dome"
    dome.scale = (1, 0.92, 0.75)
    dome.data.materials.append(green)
    bpy.ops.object.shade_smooth()
    for side in (-1, 1):
        cylinder(f"Masjid_minaret_{side}", 1.3, 20, (mx + side * 10, my - 6, 10), stone, 12)
        cone(f"Masjid_minaret_cap_{side}", 1.6, 0.2, 3.4, (mx + side * 10, my - 6, 21.6), green, 12)
    box("Masjid_arch", (5, 2, 6), (mx, my - 8.2, 3.4), dark)
    sign_text("MASJID", (mx, my - 8.6, 9.6), (math.radians(-90), 0, math.pi), 1.1, neon)

    # --- cinema with a marquee
    cx, cy = PITCH * 1.8, -PITCH * 1.2
    box("Cinema_body", (26, 18, 13), (cx, cy, 6.5), dark, bevel=0.15)
    box("Cinema_marquee", (24, 2.4, 2.2), (cx, cy - 9.6, 9), simple_mat("MarqueeWhite", (0.9, 0.88, 0.8), 0.6),
        bevel=0.06)
    sign_text("CINEMA", (cx, cy - 10.9, 9), (math.radians(-90), 0, math.pi), 1.6, pink, extrude=0.06)
    for i in range(7):
        box(f"Cinema_neon_{i}", (2.0, 0.2, 0.25), (cx - 9 + i * 3, cy - 10.9, 7.4), amber)
    # poster panels
    for i in range(3):
        plane(f"Cinema_poster_{i}", (4.2, 6.0), (cx - 8 + i * 8, cy - 9.2, 4.2),
              (math.radians(-90), 0, math.pi), emission_mat("Poster", (0.9, 0.4, 0.5), 0.8))

    # --- bus stand
    bx, by = PITCH * 2.1, PITCH * 2.1
    box("Bus_canopy", (20, 9, 0.4), (bx, by, 4.2), simple_mat("BusMetal", (0.35, 0.36, 0.38), 0.5, 0.6))
    for px in (-8, 0, 8):
        cylinder(f"Bus_post_{px}", 0.22, 4.2, (bx + px, by - 3.8, 2.1), dark, 8)
    for i in range(3):
        box(f"Bus_bench_{i}", (4.0, 0.9, 0.12), (bx - 6 + i * 6, by - 2.0, 0.55),
            simple_mat("Bench", (0.30, 0.22, 0.14), 0.85))
    sign_text("BUS STAND", (bx, by - 4.6, 4.6), (math.radians(-90), 0, math.pi), 1.0, neon, extrude=0.05)

    # --- petrol pump
    px, py = -PITCH * 2.1, PITCH * 2.2
    box("Pump_canopy", (18, 10, 0.5), (px, py, 5.0), simple_mat("PumpCanopy", (0.85, 0.82, 0.78), 0.6))
    for ox, oy in ((-6, -3), (6, -3), (-6, 3), (6, 3)):
        cylinder(f"Pump_post_{ox}_{oy}", 0.25, 5.0, (px + ox, py + oy, 2.5), dark, 8)
    for i in range(2):
        box(f"Pump_unit_{i}", (1.6, 1.2, 2.2), (px - 4 + i * 8, py, 1.1),
            simple_mat("PumpUnit", (0.70, 0.16, 0.14), 0.5, 0.3), bevel=0.06)
    sign_text("PETROL", (px, py - 5.4, 5.6), (math.radians(-90), 0, math.pi), 1.1, amber, extrude=0.05)

    # --- bazaar gate on the south avenue
    gx, gy = 0, -PITCH * 3 - 4
    for side in (-1, 1):
        box(f"Gate_pillar_{side}", (2.6, 2.6, 12), (gx + side * 9, gy, 6), stone, bevel=0.1)
    box("Gate_lintel", (21, 2.6, 2.2), (gx, gy, 12.6), stone, bevel=0.1)
    sign_text("SADAR BAZAAR", (gx, gy - 1.5, 12.6), (math.radians(-90), 0, math.pi), 1.2, pink, extrude=0.05)


def build_vehicles(mats):
    yellow = simple_mat("RickshawYellow", (0.85, 0.62, 0.06), 0.4, 0.3)
    black = simple_mat("RickshawBlack", (0.03, 0.03, 0.035), 0.5, 0.4)
    m = {"yellow": yellow, "black": black}
    for i in range(7):
        x = -GRID * PITCH + i * 34 + rng.uniform(-6, 6)
        y = PITCH * 0.5 + rng.uniform(-4, 4)
        build_rickshaw(x, y, rng.uniform(0, math.tau), m)
    sedan_cols = [
        simple_mat("Sedan_white", (0.80, 0.78, 0.72), 0.35, 0.4),
        simple_mat("Sedan_red", (0.55, 0.10, 0.12), 0.35, 0.4),
        simple_mat("Sedan_teal", (0.10, 0.35, 0.38), 0.35, 0.4),
    ]
    for i in range(6):
        x = -GRID * PITCH + i * 40 + rng.uniform(-5, 5)
        y = -PITCH * 0.5 + rng.uniform(-4, 4)
        build_sedan(x, y, rng.uniform(0, math.tau), sedan_cols[i % 3])


def build_street_furniture():
    pole = simple_mat("Pole", (0.16, 0.17, 0.18), 0.5, 0.7)
    glow = emission_mat("StreetGlow", (1.0, 0.68, 0.34), 4.0)
    for i in range(-GRID, GRID + 1):
        for j in range(-GRID, GRID + 1):
            x = i * PITCH + BLOCK * 0.5 - 2
            y = j * PITCH + BLOCK * 0.5 - 2
            if rng.random() < 0.55:
                cylinder(f"Lamp_{i}_{j}", 0.09, 6.5, (x, y, 3.25), pole, 8)
                bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.28,
                                                     location=(x, y, 6.6))
                bulb = bpy.context.object
                bulb.name = f"LampGlow_{i}_{j}"
                bulb.data.materials.append(glow)


def build_sky_sun():
    make_sky_texture()
    img = bpy.data.images["sky"]
    mat = bpy.data.materials.new("SkyDome")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.extension = "EXTEND"
    bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Emission Strength"].default_value = 2.4
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1200)
    dome = bpy.context.object
    dome.name = "SkyDome"
    dome.data.materials.append(mat)
    dome.scale = (-1, 1, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for p in dome.data.polygons:
        p.use_smooth = True

    # the Vice City sun, low on the western horizon
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=80,
                                         location=(-900, 240, 60))
    sun = bpy.context.object
    sun.name = "SunDisc"
    sun.data.materials.append(emission_mat("SunGlow", (1.0, 0.52, 0.24), 2.0))


def build_lights():
    def add(name, kind, energy, loc, color, rot=(0, 0, 0), size=8.0):
        data = bpy.data.lights.new(name, kind)
        data.energy = energy
        data.color = color
        if kind == "AREA":
            data.size = size
        ob = bpy.data.objects.new(name, data)
        ob.location = loc
        ob.rotation_euler = rot
        bpy.context.scene.collection.objects.link(ob)

    add("SunsetKey", "SUN", 4.0, (-70, 40, 50), (1.0, 0.66, 0.44),
        rot=(math.radians(72), 0, math.radians(-42)))
    add("Fill", "AREA", 900, (60, -40, 30), (0.55, 0.62, 1.0), size=90)



def join_by_material():
    """Merge static geometry per material: ~3,000 objects become ~30 draw calls."""
    groups = {}
    for ob in list(bpy.context.scene.objects):
        if ob.type != "MESH" or ob.name in ("SkyDome", "SunDisc"):
            continue
        key = ob.data.materials[0].name if ob.data.materials else "none"
        groups.setdefault(key, []).append(ob)
    merged = 0
    for key, obs in groups.items():
        if len(obs) < 2:
            continue
        for ob in bpy.context.selected_objects:
            ob.select_set(False)
        for ob in obs:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        bpy.ops.object.join()
        out = bpy.context.object
        out.name = f"Merged_{key}"[:60]
        merged += 1
    print("merged groups:", merged)


def export_glb():
    for ob in bpy.context.selected_objects:
        ob.select_set(False)
    kwargs = dict(
        filepath=GLB_PATH,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_image_format="AUTO",
    )
    bpy.ops.export_scene.gltf(**kwargs)
    print(f"exported {GLB_PATH} ({os.path.getsize(GLB_PATH)/1024/1024:.2f} MB)")


def main():
    reset_scene()

    make_facade_texture("dec_mint", (0.55, 0.80, 0.72), (0.90, 0.94, 0.88),
                        (1.0, 0.85, 0.62), (0.55, 0.85, 1.0), 0.42, 6, 5, 21)
    make_facade_texture("dec_peach", (0.86, 0.62, 0.48), (0.95, 0.85, 0.70),
                        (1.0, 0.80, 0.55), (0.60, 0.90, 1.0), 0.38, 6, 4, 22)
    make_facade_texture("dec_lilac", (0.62, 0.55, 0.78), (0.88, 0.86, 0.95),
                        (1.0, 0.78, 0.85), (0.55, 0.85, 1.0), 0.34, 7, 4, 23)
    make_road_texture()

    facade_mats = [
        texture_mat("FacadeMint", bpy.data.images["dec_mint_base"],
                    bpy.data.images["dec_mint_emissive"], 1.15),
        texture_mat("FacadePeach", bpy.data.images["dec_peach_base"],
                    bpy.data.images["dec_peach_emissive"], 1.1),
        texture_mat("FacadeLilac", bpy.data.images["dec_lilac_base"],
                    bpy.data.images["dec_lilac_emissive"], 1.05),
    ]

    neon_pool = []
    props = []
    build_ground(facade_mats)
    for bx in range(-GRID, GRID + 1):
        for by in range(-GRID, GRID + 1):
            if abs(bx) <= 0 and abs(by) <= 0:
                continue  # roundabout with the clock tower
            build_block(bx, by, facade_mats, neon_pool, props)

    build_landmarks({})
    build_shopfronts()
    build_food_street()
    build_bazaar()
    build_landmarks_extra()
    build_vehicles({})
    build_street_furniture()

    trunk = simple_mat("PalmTrunk", (0.28, 0.20, 0.12), 0.9)
    leaf = simple_mat("PalmLeaf", (0.10, 0.32, 0.18), 0.8)
    palms = []
    west = -GRID * PITCH - 30
    for i in range(16):
        palms.append((west + rng.uniform(-4, 4), -130 + i * 17, rng.uniform(0.85, 1.2)))
    for i in range(10):
        palms.append((rng.uniform(-140, 140), PITCH * GRID + 46 + rng.uniform(-4, 4), rng.uniform(0.8, 1.1)))
    build_palms(palms, trunk, leaf)

    build_sky_sun()
    build_lights()

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.lens = 26
    cam_data.clip_end = 6000.0
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (150, -175, 95)
    cam.rotation_euler = (Vector((0, 0, 18)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam

    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.resolution_x = 1280
    sc.render.resolution_y = 720
    sc.view_settings.exposure = 0.9
    world = bpy.data.worlds[0] if bpy.data.worlds else bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.42, 0.22, 0.28, 1.0)
    bg.inputs["Strength"].default_value = 0.8

    join_by_material()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    export_glb()

    faces = sum(len(o.data.polygons) for o in sc.objects if o.type == "MESH")
    print("objects:", len(sc.objects), "faces:", faces)


if __name__ == "__main__":
    main()
