import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const base = new URL('../public/assets/models/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('white-swordsman.json', base), 'utf8'));
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const bounds = {};

for (const [quality, budget] of Object.entries({ balanced: { bytes: 4_000_000, triangles: 150_000, texture: 2048 }, compact: { bytes: 1_600_000, triangles: 65_000, texture: 1024 } })) {
  test(`${quality} model decodes within delivery budgets and retains its material maps`, async () => {
    const file = await readFile(new URL(`white-swordsman-${quality}.glb`, base));
    assert(file.byteLength <= budget.bytes);
    assert.equal(file.byteLength, manifest.variants[quality].bytes);
    const document = await io.readBinary(file), root = document.getRoot();
    let triangles = 0;
    for (const mesh of root.listMeshes()) for (const primitive of mesh.listPrimitives()) {
      triangles += primitive.getIndices().getCount() / 3;
      assert(primitive.getAttribute('NORMAL'));
      assert(primitive.getAttribute('TEXCOORD_0'));
      const material = primitive.getMaterial();
      assert(material.getBaseColorTexture());
      assert(material.getNormalTexture());
      assert(material.getMetallicRoughnessTexture());
    }
    assert(triangles > 50_000 && triangles <= budget.triangles);
    assert.equal(triangles, manifest.variants[quality].triangles);
    for (const texture of root.listTextures()) {
      assert.equal(texture.getMimeType(), 'image/webp');
      const image = await sharp(texture.getImage()).metadata();
      assert(image.width <= budget.texture && image.height <= budget.texture);
    }
    bounds[quality] = getBounds(root.getDefaultScene());
    assert(bounds[quality].max.every(Number.isFinite));
    assert(bounds[quality].min.every(Number.isFinite));
    assert(bounds[quality].max[1] - bounds[quality].min[1] > 1);
  });
}
test('quality variants preserve the same scale and framing', () => {
  for (const edge of ['min', 'max']) for (let axis = 0; axis < 3; axis++) {
    assert(Math.abs(bounds.balanced[edge][axis] - bounds.compact[edge][axis]) < .005);
  }
});
