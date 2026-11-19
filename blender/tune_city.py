"""Tune the city for the browser: calmer emissives, merged meshes."""

from pathlib import Path

p = Path(r"E:\hyderabad-city\blender\build_city.py")
t = p.read_text(encoding="utf-8")

subs = [
    ('emission_mat("AwningNeon", col, 3.6)', 'emission_mat("AwningNeon", col, 2.0)'),
    ('emission_mat("SignNeon", col, 6.0)', 'emission_mat("SignNeon", col, 3.0)'),
    ('emission_mat("StreetGlow", (1.0, 0.68, 0.34), 7.0)', 'emission_mat("StreetGlow", (1.0, 0.68, 0.34), 4.0)'),
    ('emission_mat("LanternGlow", (1.0, 0.74, 0.36), 8.0)', 'emission_mat("LanternGlow", (1.0, 0.74, 0.36), 5.0)'),
    ('emission_mat("ShopInterior", (1.0, 0.70, 0.42), 2.2)', 'emission_mat("ShopInterior", (1.0, 0.70, 0.42), 1.2)'),
    ('emission_mat(f"ShopNeon_{index % 6}", colour, 4.0)', 'emission_mat(f"ShopNeon_{index % 6}", colour, 2.4)'),
    ('emission_mat("FoodWarm", (1.0, 0.66, 0.36), 3.0)', 'emission_mat("FoodWarm", (1.0, 0.66, 0.36), 1.8)'),
    ('emission_mat("FoodPink", (1.0, 0.31, 0.64), 3.4)', 'emission_mat("FoodPink", (1.0, 0.31, 0.64), 2.2)'),
    ('emission_mat("FoodAmber", (1.0, 0.82, 0.40), 3.4)', 'emission_mat("FoodAmber", (1.0, 0.82, 0.40), 2.2)'),
    ('emission_mat("FoodBulb", (1.0, 0.80, 0.50), 6.0)', 'emission_mat("FoodBulb", (1.0, 0.80, 0.50), 3.0)'),
    ('emission_mat("ExtraNeon", (0.31, 0.89, 1.0), 5.0)', 'emission_mat("ExtraNeon", (0.31, 0.89, 1.0), 3.0)'),
    ('emission_mat("ExtraPink", (1.0, 0.31, 0.64), 5.0)', 'emission_mat("ExtraPink", (1.0, 0.31, 0.64), 3.0)'),
    ('emission_mat("ExtraAmber", (1.0, 0.82, 0.40), 5.0)', 'emission_mat("ExtraAmber", (1.0, 0.82, 0.40), 3.0)'),
    ('emission_mat("SunGlow", (1.0, 0.52, 0.24), 3.0)', 'emission_mat("SunGlow", (1.0, 0.52, 0.24), 2.0)'),
]

for old, new in subs:
    if old not in t:
        raise SystemExit("missing: " + old[:60])
    t = t.replace(old, new)

MERGE = '''

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


'''

t = t.replace("\ndef export_glb():", MERGE + "def export_glb():")

t = t.replace(
    "    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)",
    "    join_by_material()\n    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)",
)

p.write_text(t, encoding="utf-8")
print("tuned + merge step added")
