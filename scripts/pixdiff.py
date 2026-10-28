import json, sys
from PIL import Image, ImageChops
ref = Image.open(sys.argv[1]).convert('RGB'); got = Image.open(sys.argv[2]).convert('RGB')
drawn = json.load(open(sys.argv[3])); out = sys.argv[4]
W, H = ref.size; assert got.size == ref.size, (got.size, ref.size)
mask = [[False]*W for _ in range(H)]
for r in drawn:
    x, y, w, h = (r if isinstance(r, list) else [r['x'], r['y'], r['w'], r['h']])
    for yy in range(max(0,y), min(H,y+h)):
        for xx in range(max(0,x), min(W,x+w)): mask[yy][xx] = True
rp, gp = ref.load(), got.load()
masked_px = sum(row.count(True) for row in mask)
diff_all = diff_bg = maxd = 0
vis = Image.new('RGB', (W, H))
vp = vis.load()
for y in range(H):
    for x in range(W):
        a, b = rp[x, y], gp[x, y]
        d = max(abs(a[i]-b[i]) for i in range(3))
        if d: diff_all += 1
        if not mask[y][x]:
            if d: diff_bg += 1; maxd = max(maxd, d); vp[x, y] = (255, 0, 0)
            else: vp[x, y] = tuple(c//3 for c in a)
        else: vp[x, y] = (0, 0, 120) if d else (0, 60, 0)
vis.resize((W*3, H*3), Image.NEAREST).save(out)
print(json.dumps({'size': [W, H], 'total_px': W*H, 'sprite_masked_px': masked_px, 'compared_px': W*H-masked_px,
  'diff_px_outside_sprites': diff_bg, 'max_channel_delta_outside': maxd, 'diff_px_unmasked_total': diff_all}))
