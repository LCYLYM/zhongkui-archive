import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, textureCompress, meshopt, prune, listTextureSlots } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const input = new URL('../模型.glb', import.meta.url);
const output = new URL('../public/assets/models/', import.meta.url);
await mkdir(output, { recursive: true });
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const source = await readFile(input);
const manifest = { source: { bytes: source.byteLength, sha256: createHash('sha256').update(source).digest('hex') }, variants: {} };
for (const config of [
  { name: 'balanced', ratio: .095, error: .0009, color: 2048, detail: 1024, quality: 86 },
  { name: 'compact', ratio: .041, error: .002, color: 1024, detail: 512, quality: 82 },
]) {
  const document = await io.readBinary(source);
  await document.transform(
    dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: config.ratio, error: config.error }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^baseColorTexture$/, resize: [config.color, config.color], quality: config.quality, effort: 75 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(normalTexture|metallicRoughnessTexture)$/, resize: [config.detail, config.detail], lossless: true, effort: 75 }),
    prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 14 }),
  );
  const encoded = await io.writeBinary(document);
  const path = `white-swordsman-${config.name}.glb`;
  await writeFile(new URL(path, output), encoded);
  const decoded = await io.readBinary(encoded);
  let triangles = 0, vertices = 0;
  for (const mesh of decoded.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    triangles += (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
    vertices += primitive.getAttribute('POSITION').getCount();
  }
  const textures = await Promise.all(decoded.getRoot().listTextures().map(async texture => {
    const { width, height } = await sharp(texture.getImage()).metadata();
    return { slots: listTextureSlots(texture), width, height, bytes: texture.getImage().byteLength };
  }));
  manifest.variants[config.name] = { url: `/assets/models/${path}`, bytes: encoded.byteLength, triangles, vertices, textures, estimatedTextureBytes: textures.reduce((sum, texture) => sum + texture.width * texture.height * 4 * 4 / 3, 0), config };
  console.log(config.name, JSON.stringify(manifest.variants[config.name]));
}
await writeFile(new URL('white-swordsman.json', output), JSON.stringify(manifest, null, 2) + '\n');
