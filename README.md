# Hyderabad, Sindh — after sunset

A stylised, walkable Hyderabad built procedurally in Blender and rendered in the
browser with Three.js. Vice City sunset palette, San Andreas street level: named
shopfronts, a food street, a bazaar, rickshaws and a clock tower.

**Run it**

```bash
cd E:\hyderabad-city
pnpm install
pnpm dev        # http://127.0.0.1:5190
```

**Controls** — `W A S D` walk · `Shift` run · drag to look · `N` neon · `R` reset.

## What is in the city

| Layer | Contents |
|---|---|
| Blocks | 48 city blocks with raised pavements, curbs and 130+ buildings |
| Shopfronts | Every building gets a lit front; 30 shop types — chai khana, biryani centre, mobile zone, cloth house, pharmacy, bakery, nihari, haleem, paan shop, ajrak house, sindhi topi, gold jewellers, cyber cafe… |
| Food street | 8 restaurants with marquee signs, tables, stools and string lights |
| Bazaar | 8 canopy stalls with goods, cloth overhead |
| Landmarks | Pakka Qila gate, clock tower with HYDERABAD sign, mosque (dome + two minarets), cinema with marquee and posters, bus stand, petrol pump, Sadar Bazaar gate |
| Street life | moving auto-rickshaws and sedans with headlights, 22 walking pedestrians, 46 trees, 10 bicycles, 12 animals (cows, goats, dogs), street lamps, palms, waterfront railing and a bridge |
| Destinations | Hyderabad Mall, a roadside Dhaba with charpais and a clay oven, a Gym, a Shoes shop — each with a glowing canvas sign |
| Sky | custom shader: sunset gradient, sun disc with glow, drifting cloud bands |
| World | sunset sky dome, sun disc, sea to the west |

**Scene facts:** 147,732 faces · merged to 75 draw calls · glTF **19.4 MB** ·
textures generated in-script (facades, road, sand, sky).

## Rebuild the city

```bash
blender -b --python blender/build_city.py
```

Writes `blender/hyderabad.blend`, `public/models/hyderabad.glb` and the texture
set. Everything is procedural — no asset packs.

## Structure

```
blender/build_city.py     the whole city, generated + exported
src/main.js               renderer, sunset light rig, first-person walk, radar
src/styles.css            HUD: plate, clock, compass, radar, grain, vignette
scripts/shot.mjs          headless screenshots (aerial → street → walk → look)
public/models/*.glb       the city
public/textures/*.png     generated facades, road, sand, sky
```

## Known rough edges

- The sky is a gradient dome; low fog plus the dome's own falloff keeps it fairly flat
  at street level. A proper sky shader would give a real sun and clouds.
- Buildings are stylised slabs with generated window grids, not bespoke architecture.
- Traffic, pedestrians, animals and bicycles are generated in the browser, not in
  Blender, so they can move; they have no collision with the player.
- The mall/dhaba/gym/shoes buildings are separate from the Blender city and sit
  outside the block grid (at ±96 m).
- 19.4 MB glb: fine over localhost or a LAN, heavy on a phone. Draco or mesh
  simplification would cut it.
