import type { PluginObj } from '@babel/core';
import type { PluginOptions } from './types';

export default function enforceDirectAccessPlugin(): PluginObj {
  return {
    name: 'babel-plugin-enforce-direct-access',
    visitor: {
      // Plugin implementation will be added later
    },
  };
}

export type { PluginOptions } from './types';
