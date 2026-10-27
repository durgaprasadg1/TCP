import { TEST_CATEGORIES, listMachines } from '@cw/core';
import { API_LIMITS } from '../schemas/requests';

export function getExamples() {
  return {
    machines: listMachines(),
    testCategories: TEST_CATEGORIES,
    limits: API_LIMITS,
  };
}
