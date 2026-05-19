// Port of grid.py — coordinate transforms between grid and screen space
import { GRID_H } from '../constants';

let cellSize = 10;
let halfCell = 5;

export function setScreenHeight(height: number): void {
  cellSize = Math.floor(height / GRID_H);
  halfCell = cellSize >> 1;
}

export function getCellSize(): number { return cellSize; }

export function gridToScr(x: number, y: number): [number, number] {
  return [x * cellSize + halfCell, y * cellSize + halfCell];
}

export function scrToGrid(px: number, py: number): [number, number] {
  return [Math.floor(px / cellSize), Math.floor(py / cellSize)];
}

export function floatGridToScr(x: number, y: number): [number, number] {
  return [x * cellSize + halfCell, y * cellSize + halfCell];
}
