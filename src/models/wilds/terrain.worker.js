import { VALLEY, bakeCore, createHeightGrid } from '../../core/wilds/valley.js';
import { surveyGround } from './terrain-data.js';

self.onmessage = ({ data }) => {
  const { core } = VALLEY;
  if (data.kind === 'heights') {
    const baked = bakeCore({ ...core, minZ: core.minZ + data.rows[0] * core.step, maxZ: core.minZ + (data.rows[1] - 1) * core.step });
    self.postMessage({ kind: 'heights', rows: data.rows, heights: baked.heights }, [baked.heights.buffer]);
  } else if (data.kind === 'survey') {
    const grid = createHeightGrid(data.heights, data.layout);
    const { colors, mask } = surveyGround(grid, data.rows);
    self.postMessage({ kind: 'survey', rows: data.rows, colors, mask }, [colors.buffer, mask.buffer]);
  }
};
