"""Add the street level: named shopfronts, a food street, a bazaar, mosques,
a cinema, a bus stand and a petrol pump."""

from pathlib import Path

path = Path(r"E:\hyderabad-city\blender\build_city.py")
src = path.read_text(encoding="utf-8")

# ---------------------------------------------------------------- records
src = src.replace(
    "BLOCK = 46.0",
    "BUILDINGS = []   # every building, so the street layer can dress them\n\nBLOCK = 46.0",
)

src = src.replace(
    """        b = box(name, (w, d, h), (x, y, h / 2), mat, bevel=0.12, uv_scale=10)
        props.append(b)""",
    """        b = box(name, (w, d, h), (x, y, h / 2), mat, bevel=0.12, uv_scale=10)
        props.append(b)
        BUILDINGS.append({"x": x, "y": y, "w": w, "d": d, "h": h,
                          "bx": bx, "by": by, "name": name})""",
)

EXTRA = '''

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
    warm = emission_mat("ShopInterior", (1.0, 0.70, 0.42), 2.2)
    glass = simple_mat("ShopGlass", (0.05, 0.07, 0.09), 0.15, 0.5)
    neon = emission_mat(f"ShopNeon_{index % 6}", colour, 4.0)

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
                  min(0.62, w * 0.12), neon, extrude=0.03)
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
    warm = emission_mat("FoodWarm", (1.0, 0.66, 0.36), 3.0)
    pink = emission_mat("FoodPink", (1.0, 0.31, 0.64), 3.4)
    amber = emission_mat("FoodAmber", (1.0, 0.82, 0.40), 3.4)
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
            bulb.data.materials.append(emission_mat("FoodBulb", (1.0, 0.80, 0.50), 6.0))


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
    neon = emission_mat("ExtraNeon", (0.31, 0.89, 1.0), 5.0)
    pink = emission_mat("ExtraPink", (1.0, 0.31, 0.64), 5.0)
    amber = emission_mat("ExtraAmber", (1.0, 0.82, 0.40), 5.0)
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
'''

src = src.replace("\ndef build_vehicles(mats):", EXTRA + "\n\ndef build_vehicles(mats):")

# hook everything into main()
src = src.replace(
    "    build_landmarks({})\n    build_vehicles({})",
    "    build_landmarks({})\n    build_shopfronts()\n    build_food_street()\n    build_bazaar()\n    build_landmarks_extra()\n    build_vehicles({})",
)

path.write_text(src, encoding="utf-8")
print("street layer added")
