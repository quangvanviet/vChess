// Gói Three.js r158 + hậu kỳ (pmndrs postprocessing, N8AO SSAO) + RGBELoader cho HDRI → window.THREE
import * as T from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset, EdgeDetectionMode, VignetteEffect, ToneMappingEffect, ToneMappingMode, BlendFunction } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
const THREE = Object.assign({}, T, { RGBELoader, RoundedBoxGeometry, N8AOPostPass, PP: { EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset, EdgeDetectionMode, VignetteEffect, ToneMappingEffect, ToneMappingMode, BlendFunction } });
window.THREE = THREE;
